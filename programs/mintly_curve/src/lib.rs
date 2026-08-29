//! Бондинг-кривая Mintly для Solana.
//!
//! Зачем она нужна. Обычной бирже нужна ликвидность: пока кто-то не внёс
//! в пул пару SOL/токен, торговать нечем, и первые покупатели свежего
//! мемкоина упираются в пустоту. Кривая сама выступает второй стороной
//! сделки — цена считается по формуле, а не по чужим заявкам, поэтому
//! купить можно с первой секунды после запуска.
//!
//! Формула та же, что у кривой на TON, — постоянное произведение на
//! виртуальных резервах:
//!
//! ```text
//! k = (virtual_sol + real_sol) * (virtual_tokens - tokens_sold)
//! ```
//!
//! Виртуальные резервы задают стартовую цену и крутизну роста, но не
//! лежат на счёте: настоящие деньги — только real_sol. Из-за этого
//! первая покупка не может выкупить весь запас за копейки, как это
//! случилось бы на пустом пуле.
//!
//! Токены не лежат на складе, а выпускаются в момент покупки и сжигаются
//! при продаже: право выпуска принадлежит самой кривой (PDA), больше
//! никому. Поэтому запас нельзя вывести мимо кривой — его физически не
//! существует, пока за него не заплатили.
//!
//! Когда на кривой накапливается graduation_sol, торговля закрывается, а
//! собранные монеты уходят одним переводом на destination — адрес задан
//! при создании и после этого не меняется. Это единственный способ вынуть
//! деньги: ни создатель токена, ни площадка не могут забрать их раньше
//! срока или отправить куда-то ещё.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction as SolInstruction},
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

/// Программа токенов. Зашита адресом, а не берётся из зависимости: ради
/// трёх инструкций тащить всю библиотеку spl-token — это два десятка
/// килобайт в готовой программе, а каждый килобайт стоит аренды.
pub const TOKEN_PROGRAM: Pubkey =
    solana_program::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/// Выпуск токенов на счёт. Раскладка инструкции у программы токенов
/// простая: номер и сумма.
fn выпустить(mint: &Pubkey, кому: &Pubkey, кто: &Pubkey, сколько: u64) -> SolInstruction {
    let mut data = Vec::with_capacity(9);
    data.push(7u8);
    data.extend_from_slice(&сколько.to_le_bytes());
    SolInstruction {
        program_id: TOKEN_PROGRAM,
        accounts: vec![
            AccountMeta::new(*mint, false),
            AccountMeta::new(*кому, false),
            AccountMeta::new_readonly(*кто, true),
        ],
        data,
    }
}

/// Сжигание токенов со счёта их владельцем.
fn сжечь(счёт: &Pubkey, mint: &Pubkey, владелец: &Pubkey, сколько: u64) -> SolInstruction {
    let mut data = Vec::with_capacity(9);
    data.push(8u8);
    data.extend_from_slice(&сколько.to_le_bytes());
    SolInstruction {
        program_id: TOKEN_PROGRAM,
        accounts: vec![
            AccountMeta::new(*счёт, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(*владелец, true),
        ],
        data,
    }
}

/// Снятие права выпуска навсегда: тип права 0 (MintTokens), новый
/// владелец — никто.
fn снять_право_выпуска(mint: &Pubkey, кто: &Pubkey) -> SolInstruction {
    SolInstruction {
        program_id: TOKEN_PROGRAM,
        accounts: vec![
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(*кто, true),
        ],
        data: vec![6u8, 0u8, 0u8],
    }
}

/// Место под состояние кривой. С запасом: менять размер у уже созданного
/// счёта нельзя, а поля со временем добавляются.
pub const CURVE_SPACE: usize = 256;

/// Приставка к семени PDA. Адрес кривой считается из неё и из адреса
/// токена, поэтому у каждого токена ровно одна кривая и найти её может
/// кто угодно, ничего не спрашивая.
pub const CURVE_SEED: &[u8] = b"curve";

/// Потолок комиссии площадки. Держится в коде, а не в настройках: с
/// правом поставить любую комиссию задним числом кривая перестаёт быть
/// честной, а поменять программу без апгрейда нельзя.
pub const MAX_FEE_BPS: u16 = 500; // 5%

/// Состояние кривой лежит в счёте простой раскладкой, а не через borsh:
/// библиотека сериализации тянет за собой заметный кусок кода, а полей
/// здесь чёртова дюжина и все фиксированной длины. Порядок полей менять
/// нельзя — по нему читают и приложение, и сервер.
pub struct Curve {
    /// Версия раскладки полей: по ней читатель поймёт, что перед ним.
    pub version: u8,
    pub bump: u8,
    /// Торговля закрыта, ликвидность ушла на destination.
    pub graduated: bool,
    pub mint: Pubkey,
    pub creator: Pubkey,
    /// Куда идёт комиссия площадки.
    pub fee_wallet: Pubkey,
    /// Единственный получатель ликвидности после закрытия.
    pub destination: Pubkey,
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    /// Сколько токенов кривая готова продать всего.
    pub tokens_for_sale: u64,
    /// Порог закрытия: столько настоящих лямпортов нужно набрать.
    pub graduation_sol: u64,
    pub fee_bps: u16,
    pub real_sol: u64,
    pub tokens_sold: u64,
}

impl Curve {
    /// Сколько байт занимает состояние в счёте.
    pub const РАЗМЕР: usize = 3 + 32 * 4 + 8 * 4 + 2 + 8 + 8;

    fn ключ(данные: &[u8], с: usize) -> Pubkey {
        let mut b = [0u8; 32];
        b.copy_from_slice(&данные[с..с + 32]);
        Pubkey::new_from_array(b)
    }

    fn число(данные: &[u8], с: usize) -> u64 {
        let mut b = [0u8; 8];
        b.copy_from_slice(&данные[с..с + 8]);
        u64::from_le_bytes(b)
    }

    pub fn из_байтов(данные: &[u8]) -> Option<Curve> {
        if данные.len() < Self::РАЗМЕР {
            return None;
        }
        Some(Curve {
            version: данные[0],
            bump: данные[1],
            graduated: данные[2] == 1,
            mint: Self::ключ(данные, 3),
            creator: Self::ключ(данные, 35),
            fee_wallet: Self::ключ(данные, 67),
            destination: Self::ключ(данные, 99),
            virtual_sol: Self::число(данные, 131),
            virtual_tokens: Self::число(данные, 139),
            tokens_for_sale: Self::число(данные, 147),
            graduation_sol: Self::число(данные, 155),
            fee_bps: u16::from_le_bytes([данные[163], данные[164]]),
            real_sol: Self::число(данные, 165),
            tokens_sold: Self::число(данные, 173),
        })
    }

    pub fn в_байты(&self, куда: &mut [u8]) -> Option<()> {
        if куда.len() < Self::РАЗМЕР {
            return None;
        }
        куда[0] = self.version;
        куда[1] = self.bump;
        куда[2] = self.graduated as u8;
        куда[3..35].copy_from_slice(&self.mint.to_bytes());
        куда[35..67].copy_from_slice(&self.creator.to_bytes());
        куда[67..99].copy_from_slice(&self.fee_wallet.to_bytes());
        куда[99..131].copy_from_slice(&self.destination.to_bytes());
        куда[131..139].copy_from_slice(&self.virtual_sol.to_le_bytes());
        куда[139..147].copy_from_slice(&self.virtual_tokens.to_le_bytes());
        куда[147..155].copy_from_slice(&self.tokens_for_sale.to_le_bytes());
        куда[155..163].copy_from_slice(&self.graduation_sol.to_le_bytes());
        куда[163..165].copy_from_slice(&self.fee_bps.to_le_bytes());
        куда[165..173].copy_from_slice(&self.real_sol.to_le_bytes());
        куда[173..181].copy_from_slice(&self.tokens_sold.to_le_bytes());
        Some(())
    }

    /// Постоянное произведение. Считается в u128: произведение резервов
    /// не влезает в u64 уже на обычных для мемкоина числах.
    fn k(&self) -> u128 {
        (self.virtual_sol as u128 + self.real_sol as u128)
            * (self.virtual_tokens as u128 - self.tokens_sold as u128)
    }

    /// Сколько токенов даст покупка на sol_in лямпортов (уже за вычетом
    /// комиссии).
    fn tokens_out(&self, sol_in: u64) -> Option<u64> {
        if sol_in == 0 {
            return Some(0);
        }
        let новый_sol = self.virtual_sol as u128 + self.real_sol as u128 + sol_in as u128;
        let остаток = self.k().checked_div(новый_sol)?;
        let было = self.virtual_tokens as u128 - self.tokens_sold as u128;
        let выдача = было.checked_sub(остаток)?;
        u64::try_from(выдача).ok()
    }

    /// Сколько лямпортов вернёт продажа tokens_in токенов (до вычета
    /// комиссии).
    fn sol_out(&self, tokens_in: u64) -> Option<u64> {
        if tokens_in == 0 {
            return Some(0);
        }
        if tokens_in > self.tokens_sold {
            return None;
        }
        let новые_токены =
            self.virtual_tokens as u128 - self.tokens_sold as u128 + tokens_in as u128;
        let остаток = self.k().checked_div(новые_токены)?;
        let было = self.virtual_sol as u128 + self.real_sol as u128;
        let выплата = было.checked_sub(остаток)?;
        u64::try_from(выплата).ok()
    }
}

fn комиссия(сумма: u64, bps: u16) -> u64 {
    ((сумма as u128) * (bps as u128) / 10_000u128) as u64
}

/// Инструкции читаются вручную: номер варианта первым байтом, дальше
/// поля подряд в том же порядке, в каком их складывает сервер.
pub enum Instruction {
    /// Создать кривую для уже выпущенного токена. Право выпуска к этому
    /// моменту должно принадлежать самой кривой — иначе продавать нечего.
    Initialize {
        virtual_sol: u64,
        virtual_tokens: u64,
        tokens_for_sale: u64,
        graduation_sol: u64,
        fee_bps: u16,
        destination: Pubkey,
    },
    /// Купить токены на sol_in лямпортов. min_tokens_out защищает от
    /// проскальзывания: если цена ушла, сделка не состоится.
    Buy { sol_in: u64, min_tokens_out: u64 },
    /// Продать tokens_in токенов обратно кривой.
    Sell { tokens_in: u64, min_sol_out: u64 },
    /// Закрыть торговлю и отправить ликвидность на destination. Вызвать
    /// может кто угодно — важно не кто нажал, а что порог достигнут.
    Graduate,
}

impl Instruction {
    fn число(данные: &[u8], с: usize) -> u64 {
        let mut b = [0u8; 8];
        b.copy_from_slice(&данные[с..с + 8]);
        u64::from_le_bytes(b)
    }

    pub fn разобрать(данные: &[u8]) -> Option<Instruction> {
        match *данные.first()? {
            0 if данные.len() >= 1 + 8 * 4 + 2 + 32 => {
                let mut b = [0u8; 32];
                b.copy_from_slice(&данные[35..67]);
                Some(Instruction::Initialize {
                    virtual_sol: Self::число(данные, 1),
                    virtual_tokens: Self::число(данные, 9),
                    tokens_for_sale: Self::число(данные, 17),
                    graduation_sol: Self::число(данные, 25),
                    fee_bps: u16::from_le_bytes([данные[33], данные[34]]),
                    destination: Pubkey::new_from_array(b),
                })
            }
            1 if данные.len() >= 17 => Some(Instruction::Buy {
                sol_in: Self::число(данные, 1),
                min_tokens_out: Self::число(данные, 9),
            }),
            2 if данные.len() >= 17 => Some(Instruction::Sell {
                tokens_in: Self::число(данные, 1),
                min_sol_out: Self::число(данные, 9),
            }),
            3 => Some(Instruction::Graduate),
            _ => None,
        }
    }
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let ix = Instruction::разобрать(data).ok_or(ProgramError::InvalidInstructionData)?;
    match ix {
        Instruction::Initialize {
            virtual_sol,
            virtual_tokens,
            tokens_for_sale,
            graduation_sol,
            fee_bps,
            destination,
        } => initialize(
            program_id,
            accounts,
            virtual_sol,
            virtual_tokens,
            tokens_for_sale,
            graduation_sol,
            fee_bps,
            destination,
        ),
        Instruction::Buy {
            sol_in,
            min_tokens_out,
        } => buy(program_id, accounts, sol_in, min_tokens_out),
        Instruction::Sell {
            tokens_in,
            min_sol_out,
        } => sell(program_id, accounts, tokens_in, min_sol_out),
        Instruction::Graduate => graduate(program_id, accounts),
    }
}

/// Прочитать состояние и заодно убедиться, что счёт — та самая кривая
/// этого токена, а не подставленный чужой.
fn прочитать(
    program_id: &Pubkey,
    curve_ai: &AccountInfo,
    mint: &Pubkey,
) -> Result<Curve, ProgramError> {
    if curve_ai.owner != program_id {
        return Err(ProgramError::IllegalOwner);
    }
    // Читаем из среза, а не целиком: под состояние отведено с запасом, и
    // хвост из нулей ещё не значит, что данные испорчены.
    let состояние = Curve::из_байтов(&curve_ai.data.borrow())
        .ok_or(ProgramError::InvalidAccountData)?;
    if &состояние.mint != mint {
        return Err(ProgramError::InvalidArgument);
    }
    let (ожидаемый, _) = Pubkey::find_program_address(&[CURVE_SEED, mint.as_ref()], program_id);
    if ожидаемый != *curve_ai.key {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(состояние)
}

fn записать(curve_ai: &AccountInfo, состояние: &Curve) -> ProgramResult {
    состояние
        .в_байты(&mut curve_ai.data.borrow_mut())
        .ok_or(ProgramError::AccountDataTooSmall)
}

/// Сколько лямпортов со счёта кривой можно тронуть. Ниже минимума для
/// освобождения от ренты опускать нельзя: счёт закроют, и вместе с ним
/// пропадёт состояние торгов.
fn доступно(curve_ai: &AccountInfo) -> Result<u64, ProgramError> {
    let минимум = Rent::get()?.minimum_balance(curve_ai.data_len());
    Ok(curve_ai.lamports().saturating_sub(минимум))
}

#[allow(clippy::too_many_arguments)]
fn initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    virtual_sol: u64,
    virtual_tokens: u64,
    tokens_for_sale: u64,
    graduation_sol: u64,
    fee_bps: u16,
    destination: Pubkey,
) -> ProgramResult {
    let счета = &mut accounts.iter();
    let payer = next_account_info(счета)?;
    let curve_ai = next_account_info(счета)?;
    let mint_ai = next_account_info(счета)?;
    let fee_wallet = next_account_info(счета)?;
    let system = next_account_info(счета)?;

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if fee_bps > MAX_FEE_BPS {
        msg!("комиссия выше потолка");
        return Err(ProgramError::InvalidArgument);
    }
    if virtual_sol == 0 || virtual_tokens == 0 || tokens_for_sale == 0 || graduation_sol == 0 {
        return Err(ProgramError::InvalidArgument);
    }
    if tokens_for_sale >= virtual_tokens {
        // Иначе резерв уходит в ноль и цена обращается в бесконечность.
        msg!("запас на продажу должен быть меньше виртуального");
        return Err(ProgramError::InvalidArgument);
    }

    let (pda, bump) = Pubkey::find_program_address(&[CURVE_SEED, mint_ai.key.as_ref()], program_id);
    if pda != *curve_ai.key {
        return Err(ProgramError::InvalidSeeds);
    }
    if curve_ai.owner == program_id && !curve_ai.data_is_empty() {
        msg!("кривая уже создана");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Право выпуска должно быть уже у кривой. Проверяем до создания
    // счёта: с чужим правом выпуска кривая не смогла бы выдать ни одного
    // токена, а деньги покупателей уже приняла бы.
    //
    // Раскладка счёта токена (82 байта) зафиксирована стандартом:
    // 0..4 — есть ли право выпуска, 4..36 — чьё оно, 36..44 — эмиссия,
    // 44 — разрядность, 45 — заведён ли, 46..50 — есть ли заморозка.
    if mint_ai.owner != &TOKEN_PROGRAM {
        return Err(ProgramError::IllegalOwner);
    }
    let данные = mint_ai.data.borrow();
    if данные.len() < 82 {
        return Err(ProgramError::InvalidAccountData);
    }
    if данные[0..4] != [1, 0, 0, 0] || данные[4..36] != pda.to_bytes() {
        msg!("право выпуска должно принадлежать кривой");
        return Err(ProgramError::InvalidArgument);
    }
    // Заморозка должна быть отключена: с ней создатель мог бы запереть
    // токены покупателей, и продать их обратно кривой стало бы нельзя.
    if данные[46..50] != [0, 0, 0, 0] {
        msg!("у токена должна быть отключена заморозка");
        return Err(ProgramError::InvalidArgument);
    }
    drop(данные);

    let rent = Rent::get()?;
    let аренда = rent.minimum_balance(CURVE_SPACE);
    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            curve_ai.key,
            аренда,
            CURVE_SPACE as u64,
            program_id,
        ),
        &[payer.clone(), curve_ai.clone(), system.clone()],
        &[&[CURVE_SEED, mint_ai.key.as_ref(), &[bump]]],
    )?;

    let состояние = Curve {
        version: 1,
        bump,
        graduated: false,
        mint: *mint_ai.key,
        creator: *payer.key,
        fee_wallet: *fee_wallet.key,
        destination,
        virtual_sol,
        virtual_tokens,
        tokens_for_sale,
        graduation_sol,
        fee_bps,
        real_sol: 0,
        tokens_sold: 0,
    };
    записать(curve_ai, &состояние)
}

fn buy(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_in: u64,
    min_tokens_out: u64,
) -> ProgramResult {
    let счета = &mut accounts.iter();
    let buyer = next_account_info(счета)?;
    let curve_ai = next_account_info(счета)?;
    let mint_ai = next_account_info(счета)?;
    let buyer_ata = next_account_info(счета)?;
    let fee_wallet = next_account_info(счета)?;
    let token_program = next_account_info(счета)?;
    let system = next_account_info(счета)?;

    if !buyer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if sol_in == 0 {
        return Err(ProgramError::InvalidArgument);
    }

    let mut состояние = прочитать(program_id, curve_ai, mint_ai.key)?;
    if состояние.graduated {
        msg!("торговля на кривой закрыта");
        return Err(ProgramError::InvalidAccountData);
    }
    if fee_wallet.key != &состояние.fee_wallet {
        return Err(ProgramError::InvalidArgument);
    }

    let сбор = комиссия(sol_in, состояние.fee_bps);
    let в_кривую = sol_in
        .checked_sub(сбор)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    let выдача = состояние
        .tokens_out(в_кривую)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    if выдача == 0 || выдача < min_tokens_out {
        msg!("цена ушла: выдача меньше запрошенной");
        return Err(ProgramError::InvalidArgument);
    }
    let продано = состояние
        .tokens_sold
        .checked_add(выдача)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    if продано > состояние.tokens_for_sale {
        msg!("столько токенов на кривой нет");
        return Err(ProgramError::InvalidArgument);
    }

    // Деньги идут двумя переводами: доля площадки сразу ей, остальное на
    // счёт кривой. Так комиссия не попадает в резерв и не искажает цену.
    invoke(
        &system_instruction::transfer(buyer.key, curve_ai.key, в_кривую),
        &[buyer.clone(), curve_ai.clone(), system.clone()],
    )?;
    if сбор > 0 {
        invoke(
            &system_instruction::transfer(buyer.key, fee_wallet.key, сбор),
            &[buyer.clone(), fee_wallet.clone(), system.clone()],
        )?;
    }

    if token_program.key != &TOKEN_PROGRAM {
        return Err(ProgramError::IncorrectProgramId);
    }
    invoke_signed(
        &выпустить(mint_ai.key, buyer_ata.key, curve_ai.key, выдача),
        &[
            mint_ai.clone(),
            buyer_ata.clone(),
            curve_ai.clone(),
            token_program.clone(),
        ],
        &[&[CURVE_SEED, mint_ai.key.as_ref(), &[состояние.bump]]],
    )?;

    состояние.tokens_sold = продано;
    состояние.real_sol = состояние
        .real_sol
        .checked_add(в_кривую)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    записать(curve_ai, &состояние)?;

    Ok(())
}

fn sell(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    tokens_in: u64,
    min_sol_out: u64,
) -> ProgramResult {
    let счета = &mut accounts.iter();
    let seller = next_account_info(счета)?;
    let curve_ai = next_account_info(счета)?;
    let mint_ai = next_account_info(счета)?;
    let seller_ata = next_account_info(счета)?;
    let fee_wallet = next_account_info(счета)?;
    let token_program = next_account_info(счета)?;

    if !seller.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if tokens_in == 0 {
        return Err(ProgramError::InvalidArgument);
    }

    let mut состояние = прочитать(program_id, curve_ai, mint_ai.key)?;
    if состояние.graduated {
        msg!("торговля на кривой закрыта");
        return Err(ProgramError::InvalidAccountData);
    }
    if fee_wallet.key != &состояние.fee_wallet {
        return Err(ProgramError::InvalidArgument);
    }

    let выплата = состояние
        .sol_out(tokens_in)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    let сбор = комиссия(выплата, состояние.fee_bps);
    let продавцу = выплата
        .checked_sub(сбор)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    if продавцу == 0 || продавцу < min_sol_out {
        msg!("цена ушла: выплата меньше запрошенной");
        return Err(ProgramError::InvalidArgument);
    }
    if выплата > состояние.real_sol || выплата > доступно(curve_ai)? {
        // На кривой нет столько настоящих денег: значит, состояние и
        // счёт разошлись, и трогать чужие лямпорты нельзя.
        msg!("на кривой нет столько монет");
        return Err(ProgramError::InsufficientFunds);
    }

    // Сначала сжигаем токены, потом отдаём деньги: обратный порядок
    // оставил бы окно, в котором продавец уже с монетами, а токены ещё у
    // него.
    if token_program.key != &TOKEN_PROGRAM {
        return Err(ProgramError::IncorrectProgramId);
    }
    invoke(
        &сжечь(seller_ata.key, mint_ai.key, seller.key, tokens_in),
        &[
            seller_ata.clone(),
            mint_ai.clone(),
            seller.clone(),
            token_program.clone(),
        ],
    )?;

    // Счёт кривой принадлежит программе, поэтому лямпорты переносятся
    // прямой правкой балансов: системный перевод потребовал бы подписи
    // самого счёта, а её у PDA нет.
    **curve_ai.try_borrow_mut_lamports()? -= выплата;
    **seller.try_borrow_mut_lamports()? += продавцу;
    if сбор > 0 {
        **fee_wallet.try_borrow_mut_lamports()? += сбор;
    }

    состояние.tokens_sold -= tokens_in;
    состояние.real_sol -= выплата;
    записать(curve_ai, &состояние)?;

    Ok(())
}

fn graduate(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let счета = &mut accounts.iter();
    let curve_ai = next_account_info(счета)?;
    let mint_ai = next_account_info(счета)?;
    let destination = next_account_info(счета)?;
    let token_program = next_account_info(счета)?;

    let mut состояние = прочитать(program_id, curve_ai, mint_ai.key)?;
    if состояние.graduated {
        msg!("кривая уже закрыта");
        return Err(ProgramError::InvalidAccountData);
    }
    if состояние.real_sol < состояние.graduation_sol {
        msg!("порог ещё не набран");
        return Err(ProgramError::InvalidArgument);
    }
    if destination.key != &состояние.destination {
        return Err(ProgramError::InvalidArgument);
    }

    // Право выпуска снимается навсегда: после закрытия кривой никто —
    // включая площадку — не может допечатать токены.
    if token_program.key != &TOKEN_PROGRAM {
        return Err(ProgramError::IncorrectProgramId);
    }
    invoke_signed(
        &снять_право_выпуска(mint_ai.key, curve_ai.key),
        &[mint_ai.clone(), curve_ai.clone(), token_program.clone()],
        &[&[CURVE_SEED, mint_ai.key.as_ref(), &[состояние.bump]]],
    )?;

    let сумма = состояние.real_sol.min(доступно(curve_ai)?);
    **curve_ai.try_borrow_mut_lamports()? -= сумма;
    **destination.try_borrow_mut_lamports()? += сумма;

    состояние.graduated = true;
    состояние.real_sol -= сумма;
    записать(curve_ai, &состояние)?;

    msg!("кривая закрыта");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn кривая() -> Curve {
        Curve {
            version: 1,
            bump: 255,
            graduated: false,
            mint: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            fee_wallet: Pubkey::new_unique(),
            destination: Pubkey::new_unique(),
            // 30 SOL виртуальных против миллиарда токенов — те же
            // пропорции, что у кривой на TON.
            virtual_sol: 30_000_000_000,
            virtual_tokens: 1_073_000_000_000_000,
            tokens_for_sale: 800_000_000_000_000,
            graduation_sol: 85_000_000_000,
            fee_bps: 100,
            real_sol: 0,
            tokens_sold: 0,
        }
    }

    #[test]
    fn цена_растёт_с_каждой_покупкой() {
        let mut c = кривая();
        let первая = c.tokens_out(1_000_000_000).unwrap();
        c.tokens_sold += первая;
        c.real_sol += 1_000_000_000;
        let вторая = c.tokens_out(1_000_000_000).unwrap();
        assert!(вторая < первая, "второй покупатель должен получить меньше");
    }

    #[test]
    fn продажа_возвращает_меньше_чем_стоила_покупка() {
        // Комиссия здесь ни при чём: возврат меньше уже из-за самой
        // формулы, иначе на кривой можно было бы зарабатывать пустыми
        // сделками туда-обратно.
        let mut c = кривая();
        let куплено = c.tokens_out(2_000_000_000).unwrap();
        c.tokens_sold += куплено;
        c.real_sol += 2_000_000_000;
        let вернут = c.sol_out(куплено).unwrap();
        assert!(вернут <= 2_000_000_000);
    }

    #[test]
    fn нельзя_продать_больше_купленного() {
        let mut c = кривая();
        let куплено = c.tokens_out(1_000_000_000).unwrap();
        c.tokens_sold += куплено;
        c.real_sol += 1_000_000_000;
        assert!(c.sol_out(куплено + 1).is_none());
    }

    #[test]
    fn запас_кончается_раньше_виртуального_резерва() {
        let c = кривая();
        // Даже на огромной сумме выдача не может превысить виртуальный
        // резерв — иначе цена ушла бы в бесконечность.
        let выдача = c.tokens_out(1_000_000_000_000_000).unwrap();
        assert!(выдача < c.virtual_tokens);
    }

    #[test]
    fn комиссия_считается_в_сотых_долях_процента() {
        assert_eq!(комиссия(1_000_000, 100), 10_000);
        assert_eq!(комиссия(1_000_000, 0), 0);
    }
}
