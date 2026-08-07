import {
    Cell,
    Slice,
    Address,
    Builder,
    beginCell,
    ComputeError,
    TupleItem,
    TupleReader,
    Dictionary,
    contractAddress,
    address,
    ContractProvider,
    Sender,
    Contract,
    ContractABI,
    ABIType,
    ABIGetter,
    ABIReceiver,
    TupleBuilder,
    DictionaryValue
} from '@ton/core';

export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
}

export function storeDataSize(src: DataSize) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}

export function loadDataSize(slice: Slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadGetterTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function storeTupleDataSize(source: DataSize) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}

export function dictValueParserDataSize(): DictionaryValue<DataSize> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    }
}

export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
}

export function storeSignedBundle(src: SignedBundle) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}

export function loadSignedBundle(slice: Slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadGetterTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function storeTupleSignedBundle(source: SignedBundle) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}

export function dictValueParserSignedBundle(): DictionaryValue<SignedBundle> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    }
}

export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
}

export function storeStateInit(src: StateInit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}

export function loadStateInit(slice: Slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadGetterTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function storeTupleStateInit(source: StateInit) {
    const builder = new TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserStateInit(): DictionaryValue<StateInit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    }
}

export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
}

export function storeContext(src: Context) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}

export function loadContext(slice: Slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadGetterTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function storeTupleContext(source: Context) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}

export function dictValueParserContext(): DictionaryValue<Context> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    }
}

export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeSendParameters(src: SendParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        if (src.code !== null && src.code !== undefined) { b_0.storeBit(true).storeRef(src.code); } else { b_0.storeBit(false); }
        if (src.data !== null && src.data !== undefined) { b_0.storeBit(true).storeRef(src.data); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadSendParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleSendParameters(source: SendParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    }
}

export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeMessageParameters(src: MessageParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadMessageParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleMessageParameters(source: MessageParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserMessageParameters(): DictionaryValue<MessageParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    }
}

export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
}

export function storeDeployParameters(src: DeployParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}

export function loadDeployParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadGetterTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function storeTupleDeployParameters(source: DeployParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}

export function dictValueParserDeployParameters(): DictionaryValue<DeployParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    }
}

export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
}

export function storeStdAddress(src: StdAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}

export function loadStdAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleStdAddress(source: StdAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}

export function dictValueParserStdAddress(): DictionaryValue<StdAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    }
}

export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
}

export function storeVarAddress(src: VarAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}

export function loadVarAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleVarAddress(source: VarAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}

export function dictValueParserVarAddress(): DictionaryValue<VarAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    }
}

export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
}

export function storeBasechainAddress(src: BasechainAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) { b_0.storeBit(true).storeInt(src.hash, 257); } else { b_0.storeBit(false); }
    };
}

export function loadBasechainAddress(slice: Slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadGetterTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function storeTupleBasechainAddress(source: BasechainAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}

export function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    }
}

export type Deploy = {
    $$type: 'Deploy';
    queryId: bigint;
}

export function storeDeploy(src: Deploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2490013878, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2490013878) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadGetterTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function storeTupleDeploy(source: Deploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeploy(): DictionaryValue<Deploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadDeploy(src.loadRef().beginParse());
        }
    }
}

export type DeployOk = {
    $$type: 'DeployOk';
    queryId: bigint;
}

export function storeDeployOk(src: DeployOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2952335191, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeployOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2952335191) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadGetterTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function storeTupleDeployOk(source: DeployOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeployOk(): DictionaryValue<DeployOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployOk(src)).endCell());
        },
        parse: (src) => {
            return loadDeployOk(src.loadRef().beginParse());
        }
    }
}

export type FactoryDeploy = {
    $$type: 'FactoryDeploy';
    queryId: bigint;
    cashback: Address;
}

export function storeFactoryDeploy(src: FactoryDeploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1829761339, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.cashback);
    };
}

export function loadFactoryDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1829761339) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _cashback = sc_0.loadAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadGetterTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function storeTupleFactoryDeploy(source: FactoryDeploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.cashback);
    return builder.build();
}

export function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFactoryDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadFactoryDeploy(src.loadRef().beginParse());
        }
    }
}

export type JettonTransfer = {
    $$type: 'JettonTransfer';
    queryId: bigint;
    amount: bigint;
    destination: Address;
    responseDestination: Address | null;
    customPayload: Cell | null;
    forwardTonAmount: bigint;
    forwardPayload: Slice;
}

export function storeJettonTransfer(src: JettonTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(260734629, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeCoins(src.amount);
        b_0.storeAddress(src.destination);
        b_0.storeAddress(src.responseDestination);
        if (src.customPayload !== null && src.customPayload !== undefined) { b_0.storeBit(true).storeRef(src.customPayload); } else { b_0.storeBit(false); }
        b_0.storeCoins(src.forwardTonAmount);
        b_0.storeBuilder(src.forwardPayload.asBuilder());
    };
}

export function loadJettonTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 260734629) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _amount = sc_0.loadCoins();
    const _destination = sc_0.loadAddress();
    const _responseDestination = sc_0.loadMaybeAddress();
    const _customPayload = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _forwardTonAmount = sc_0.loadCoins();
    const _forwardPayload = sc_0;
    return { $$type: 'JettonTransfer' as const, queryId: _queryId, amount: _amount, destination: _destination, responseDestination: _responseDestination, customPayload: _customPayload, forwardTonAmount: _forwardTonAmount, forwardPayload: _forwardPayload };
}

export function loadTupleJettonTransfer(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _destination = source.readAddress();
    const _responseDestination = source.readAddressOpt();
    const _customPayload = source.readCellOpt();
    const _forwardTonAmount = source.readBigNumber();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'JettonTransfer' as const, queryId: _queryId, amount: _amount, destination: _destination, responseDestination: _responseDestination, customPayload: _customPayload, forwardTonAmount: _forwardTonAmount, forwardPayload: _forwardPayload };
}

export function loadGetterTupleJettonTransfer(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _destination = source.readAddress();
    const _responseDestination = source.readAddressOpt();
    const _customPayload = source.readCellOpt();
    const _forwardTonAmount = source.readBigNumber();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'JettonTransfer' as const, queryId: _queryId, amount: _amount, destination: _destination, responseDestination: _responseDestination, customPayload: _customPayload, forwardTonAmount: _forwardTonAmount, forwardPayload: _forwardPayload };
}

export function storeTupleJettonTransfer(source: JettonTransfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.destination);
    builder.writeAddress(source.responseDestination);
    builder.writeCell(source.customPayload);
    builder.writeNumber(source.forwardTonAmount);
    builder.writeSlice(source.forwardPayload.asCell());
    return builder.build();
}

export function dictValueParserJettonTransfer(): DictionaryValue<JettonTransfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadJettonTransfer(src.loadRef().beginParse());
        }
    }
}

export type JettonTransferNotification = {
    $$type: 'JettonTransferNotification';
    queryId: bigint;
    amount: bigint;
    sender: Address;
    forwardPayload: Slice;
}

export function storeJettonTransferNotification(src: JettonTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1935855772, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeCoins(src.amount);
        b_0.storeAddress(src.sender);
        b_0.storeBuilder(src.forwardPayload.asBuilder());
    };
}

export function loadJettonTransferNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1935855772) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _amount = sc_0.loadCoins();
    const _sender = sc_0.loadAddress();
    const _forwardPayload = sc_0;
    return { $$type: 'JettonTransferNotification' as const, queryId: _queryId, amount: _amount, sender: _sender, forwardPayload: _forwardPayload };
}

export function loadTupleJettonTransferNotification(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender = source.readAddress();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'JettonTransferNotification' as const, queryId: _queryId, amount: _amount, sender: _sender, forwardPayload: _forwardPayload };
}

export function loadGetterTupleJettonTransferNotification(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender = source.readAddress();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'JettonTransferNotification' as const, queryId: _queryId, amount: _amount, sender: _sender, forwardPayload: _forwardPayload };
}

export function storeTupleJettonTransferNotification(source: JettonTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender);
    builder.writeSlice(source.forwardPayload.asCell());
    return builder.build();
}

export function dictValueParserJettonTransferNotification(): DictionaryValue<JettonTransferNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonTransferNotification(src)).endCell());
        },
        parse: (src) => {
            return loadJettonTransferNotification(src.loadRef().beginParse());
        }
    }
}

export type Buy = {
    $$type: 'Buy';
    queryId: bigint;
    minTokensOut: bigint;
}

export function storeBuy(src: Buy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1112889633, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeCoins(src.minTokensOut);
    };
}

export function loadBuy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1112889633) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _minTokensOut = sc_0.loadCoins();
    return { $$type: 'Buy' as const, queryId: _queryId, minTokensOut: _minTokensOut };
}

export function loadTupleBuy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _minTokensOut = source.readBigNumber();
    return { $$type: 'Buy' as const, queryId: _queryId, minTokensOut: _minTokensOut };
}

export function loadGetterTupleBuy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _minTokensOut = source.readBigNumber();
    return { $$type: 'Buy' as const, queryId: _queryId, minTokensOut: _minTokensOut };
}

export function storeTupleBuy(source: Buy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeNumber(source.minTokensOut);
    return builder.build();
}

export function dictValueParserBuy(): DictionaryValue<Buy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuy(src)).endCell());
        },
        parse: (src) => {
            return loadBuy(src.loadRef().beginParse());
        }
    }
}

export type SetJettonWallet = {
    $$type: 'SetJettonWallet';
    wallet: Address;
}

export function storeSetJettonWallet(src: SetJettonWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1464161354, 32);
        b_0.storeAddress(src.wallet);
    };
}

export function loadSetJettonWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1464161354) { throw Error('Invalid prefix'); }
    const _wallet = sc_0.loadAddress();
    return { $$type: 'SetJettonWallet' as const, wallet: _wallet };
}

export function loadTupleSetJettonWallet(source: TupleReader) {
    const _wallet = source.readAddress();
    return { $$type: 'SetJettonWallet' as const, wallet: _wallet };
}

export function loadGetterTupleSetJettonWallet(source: TupleReader) {
    const _wallet = source.readAddress();
    return { $$type: 'SetJettonWallet' as const, wallet: _wallet };
}

export function storeTupleSetJettonWallet(source: SetJettonWallet) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.wallet);
    return builder.build();
}

export function dictValueParserSetJettonWallet(): DictionaryValue<SetJettonWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSetJettonWallet(src)).endCell());
        },
        parse: (src) => {
            return loadSetJettonWallet(src.loadRef().beginParse());
        }
    }
}

export type Graduate = {
    $$type: 'Graduate';
    queryId: bigint;
}

export function storeGraduate(src: Graduate) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1196572996, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadGraduate(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1196572996) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Graduate' as const, queryId: _queryId };
}

export function loadTupleGraduate(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Graduate' as const, queryId: _queryId };
}

export function loadGetterTupleGraduate(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Graduate' as const, queryId: _queryId };
}

export function storeTupleGraduate(source: Graduate) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserGraduate(): DictionaryValue<Graduate> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeGraduate(src)).endCell());
        },
        parse: (src) => {
            return loadGraduate(src.loadRef().beginParse());
        }
    }
}

export type JettonExcesses = {
    $$type: 'JettonExcesses';
    queryId: bigint;
}

export function storeJettonExcesses(src: JettonExcesses) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3576854235, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadJettonExcesses(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3576854235) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'JettonExcesses' as const, queryId: _queryId };
}

export function loadTupleJettonExcesses(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'JettonExcesses' as const, queryId: _queryId };
}

export function loadGetterTupleJettonExcesses(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'JettonExcesses' as const, queryId: _queryId };
}

export function storeTupleJettonExcesses(source: JettonExcesses) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserJettonExcesses(): DictionaryValue<JettonExcesses> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonExcesses(src)).endCell());
        },
        parse: (src) => {
            return loadJettonExcesses(src.loadRef().beginParse());
        }
    }
}

export type PendingBuy = {
    $$type: 'PendingBuy';
    buyer: Address;
    ton: bigint;
    tokens: bigint;
}

export function storePendingBuy(src: PendingBuy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.buyer);
        b_0.storeCoins(src.ton);
        b_0.storeCoins(src.tokens);
    };
}

export function loadPendingBuy(slice: Slice) {
    const sc_0 = slice;
    const _buyer = sc_0.loadAddress();
    const _ton = sc_0.loadCoins();
    const _tokens = sc_0.loadCoins();
    return { $$type: 'PendingBuy' as const, buyer: _buyer, ton: _ton, tokens: _tokens };
}

export function loadTuplePendingBuy(source: TupleReader) {
    const _buyer = source.readAddress();
    const _ton = source.readBigNumber();
    const _tokens = source.readBigNumber();
    return { $$type: 'PendingBuy' as const, buyer: _buyer, ton: _ton, tokens: _tokens };
}

export function loadGetterTuplePendingBuy(source: TupleReader) {
    const _buyer = source.readAddress();
    const _ton = source.readBigNumber();
    const _tokens = source.readBigNumber();
    return { $$type: 'PendingBuy' as const, buyer: _buyer, ton: _ton, tokens: _tokens };
}

export function storeTuplePendingBuy(source: PendingBuy) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.buyer);
    builder.writeNumber(source.ton);
    builder.writeNumber(source.tokens);
    return builder.build();
}

export function dictValueParserPendingBuy(): DictionaryValue<PendingBuy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingBuy(src)).endCell());
        },
        parse: (src) => {
            return loadPendingBuy(src.loadRef().beginParse());
        }
    }
}

export type CurveData = {
    $$type: 'CurveData';
    virtualTon: bigint;
    virtualTokens: bigint;
    realTon: bigint;
    tokensSold: bigint;
    tokensForSale: bigint;
    graduationTon: bigint;
    feeBps: bigint;
    graduated: boolean;
    jettonWallet: Address | null;
}

export function storeCurveData(src: CurveData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.virtualTon, 257);
        b_0.storeInt(src.virtualTokens, 257);
        b_0.storeInt(src.realTon, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.tokensSold, 257);
        b_1.storeInt(src.tokensForSale, 257);
        b_1.storeInt(src.graduationTon, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.feeBps, 257);
        b_2.storeBit(src.graduated);
        b_2.storeAddress(src.jettonWallet);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCurveData(slice: Slice) {
    const sc_0 = slice;
    const _virtualTon = sc_0.loadIntBig(257);
    const _virtualTokens = sc_0.loadIntBig(257);
    const _realTon = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _tokensSold = sc_1.loadIntBig(257);
    const _tokensForSale = sc_1.loadIntBig(257);
    const _graduationTon = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _feeBps = sc_2.loadIntBig(257);
    const _graduated = sc_2.loadBit();
    const _jettonWallet = sc_2.loadMaybeAddress();
    return { $$type: 'CurveData' as const, virtualTon: _virtualTon, virtualTokens: _virtualTokens, realTon: _realTon, tokensSold: _tokensSold, tokensForSale: _tokensForSale, graduationTon: _graduationTon, feeBps: _feeBps, graduated: _graduated, jettonWallet: _jettonWallet };
}

export function loadTupleCurveData(source: TupleReader) {
    const _virtualTon = source.readBigNumber();
    const _virtualTokens = source.readBigNumber();
    const _realTon = source.readBigNumber();
    const _tokensSold = source.readBigNumber();
    const _tokensForSale = source.readBigNumber();
    const _graduationTon = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _graduated = source.readBoolean();
    const _jettonWallet = source.readAddressOpt();
    return { $$type: 'CurveData' as const, virtualTon: _virtualTon, virtualTokens: _virtualTokens, realTon: _realTon, tokensSold: _tokensSold, tokensForSale: _tokensForSale, graduationTon: _graduationTon, feeBps: _feeBps, graduated: _graduated, jettonWallet: _jettonWallet };
}

export function loadGetterTupleCurveData(source: TupleReader) {
    const _virtualTon = source.readBigNumber();
    const _virtualTokens = source.readBigNumber();
    const _realTon = source.readBigNumber();
    const _tokensSold = source.readBigNumber();
    const _tokensForSale = source.readBigNumber();
    const _graduationTon = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _graduated = source.readBoolean();
    const _jettonWallet = source.readAddressOpt();
    return { $$type: 'CurveData' as const, virtualTon: _virtualTon, virtualTokens: _virtualTokens, realTon: _realTon, tokensSold: _tokensSold, tokensForSale: _tokensForSale, graduationTon: _graduationTon, feeBps: _feeBps, graduated: _graduated, jettonWallet: _jettonWallet };
}

export function storeTupleCurveData(source: CurveData) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.virtualTon);
    builder.writeNumber(source.virtualTokens);
    builder.writeNumber(source.realTon);
    builder.writeNumber(source.tokensSold);
    builder.writeNumber(source.tokensForSale);
    builder.writeNumber(source.graduationTon);
    builder.writeNumber(source.feeBps);
    builder.writeBoolean(source.graduated);
    builder.writeAddress(source.jettonWallet);
    return builder.build();
}

export function dictValueParserCurveData(): DictionaryValue<CurveData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCurveData(src)).endCell());
        },
        parse: (src) => {
            return loadCurveData(src.loadRef().beginParse());
        }
    }
}

export type BondingCurve$Data = {
    $$type: 'BondingCurve$Data';
    admin: Address;
    jettonMaster: Address;
    feeWallet: Address;
    graduationDestination: Address;
    virtualTon: bigint;
    virtualTokens: bigint;
    tokensForSale: bigint;
    graduationTon: bigint;
    feeBps: bigint;
    jettonWallet: Address | null;
    realTon: bigint;
    tokensSold: bigint;
    graduated: boolean;
    pending: Dictionary<bigint, PendingBuy>;
    nextQueryId: bigint;
}

export function storeBondingCurve$Data(src: BondingCurve$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.admin);
        b_0.storeAddress(src.jettonMaster);
        b_0.storeAddress(src.feeWallet);
        const b_1 = new Builder();
        b_1.storeAddress(src.graduationDestination);
        b_1.storeCoins(src.virtualTon);
        b_1.storeCoins(src.virtualTokens);
        b_1.storeCoins(src.tokensForSale);
        b_1.storeCoins(src.graduationTon);
        b_1.storeUint(src.feeBps, 16);
        const b_2 = new Builder();
        b_2.storeAddress(src.jettonWallet);
        b_2.storeCoins(src.realTon);
        b_2.storeCoins(src.tokensSold);
        b_2.storeBit(src.graduated);
        b_2.storeDict(src.pending, Dictionary.Keys.BigUint(64), dictValueParserPendingBuy());
        b_2.storeUint(src.nextQueryId, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadBondingCurve$Data(slice: Slice) {
    const sc_0 = slice;
    const _admin = sc_0.loadAddress();
    const _jettonMaster = sc_0.loadAddress();
    const _feeWallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _graduationDestination = sc_1.loadAddress();
    const _virtualTon = sc_1.loadCoins();
    const _virtualTokens = sc_1.loadCoins();
    const _tokensForSale = sc_1.loadCoins();
    const _graduationTon = sc_1.loadCoins();
    const _feeBps = sc_1.loadUintBig(16);
    const sc_2 = sc_1.loadRef().beginParse();
    const _jettonWallet = sc_2.loadMaybeAddress();
    const _realTon = sc_2.loadCoins();
    const _tokensSold = sc_2.loadCoins();
    const _graduated = sc_2.loadBit();
    const _pending = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserPendingBuy(), sc_2);
    const _nextQueryId = sc_2.loadUintBig(64);
    return { $$type: 'BondingCurve$Data' as const, admin: _admin, jettonMaster: _jettonMaster, feeWallet: _feeWallet, graduationDestination: _graduationDestination, virtualTon: _virtualTon, virtualTokens: _virtualTokens, tokensForSale: _tokensForSale, graduationTon: _graduationTon, feeBps: _feeBps, jettonWallet: _jettonWallet, realTon: _realTon, tokensSold: _tokensSold, graduated: _graduated, pending: _pending, nextQueryId: _nextQueryId };
}

export function loadTupleBondingCurve$Data(source: TupleReader) {
    const _admin = source.readAddress();
    const _jettonMaster = source.readAddress();
    const _feeWallet = source.readAddress();
    const _graduationDestination = source.readAddress();
    const _virtualTon = source.readBigNumber();
    const _virtualTokens = source.readBigNumber();
    const _tokensForSale = source.readBigNumber();
    const _graduationTon = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _jettonWallet = source.readAddressOpt();
    const _realTon = source.readBigNumber();
    const _tokensSold = source.readBigNumber();
    const _graduated = source.readBoolean();
    const _pending = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPendingBuy(), source.readCellOpt());
    const _nextQueryId = source.readBigNumber();
    return { $$type: 'BondingCurve$Data' as const, admin: _admin, jettonMaster: _jettonMaster, feeWallet: _feeWallet, graduationDestination: _graduationDestination, virtualTon: _virtualTon, virtualTokens: _virtualTokens, tokensForSale: _tokensForSale, graduationTon: _graduationTon, feeBps: _feeBps, jettonWallet: _jettonWallet, realTon: _realTon, tokensSold: _tokensSold, graduated: _graduated, pending: _pending, nextQueryId: _nextQueryId };
}

export function loadGetterTupleBondingCurve$Data(source: TupleReader) {
    const _admin = source.readAddress();
    const _jettonMaster = source.readAddress();
    const _feeWallet = source.readAddress();
    const _graduationDestination = source.readAddress();
    const _virtualTon = source.readBigNumber();
    const _virtualTokens = source.readBigNumber();
    const _tokensForSale = source.readBigNumber();
    const _graduationTon = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _jettonWallet = source.readAddressOpt();
    const _realTon = source.readBigNumber();
    const _tokensSold = source.readBigNumber();
    const _graduated = source.readBoolean();
    const _pending = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPendingBuy(), source.readCellOpt());
    const _nextQueryId = source.readBigNumber();
    return { $$type: 'BondingCurve$Data' as const, admin: _admin, jettonMaster: _jettonMaster, feeWallet: _feeWallet, graduationDestination: _graduationDestination, virtualTon: _virtualTon, virtualTokens: _virtualTokens, tokensForSale: _tokensForSale, graduationTon: _graduationTon, feeBps: _feeBps, jettonWallet: _jettonWallet, realTon: _realTon, tokensSold: _tokensSold, graduated: _graduated, pending: _pending, nextQueryId: _nextQueryId };
}

export function storeTupleBondingCurve$Data(source: BondingCurve$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.admin);
    builder.writeAddress(source.jettonMaster);
    builder.writeAddress(source.feeWallet);
    builder.writeAddress(source.graduationDestination);
    builder.writeNumber(source.virtualTon);
    builder.writeNumber(source.virtualTokens);
    builder.writeNumber(source.tokensForSale);
    builder.writeNumber(source.graduationTon);
    builder.writeNumber(source.feeBps);
    builder.writeAddress(source.jettonWallet);
    builder.writeNumber(source.realTon);
    builder.writeNumber(source.tokensSold);
    builder.writeBoolean(source.graduated);
    builder.writeCell(source.pending.size > 0 ? beginCell().storeDictDirect(source.pending, Dictionary.Keys.BigUint(64), dictValueParserPendingBuy()).endCell() : null);
    builder.writeNumber(source.nextQueryId);
    return builder.build();
}

export function dictValueParserBondingCurve$Data(): DictionaryValue<BondingCurve$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBondingCurve$Data(src)).endCell());
        },
        parse: (src) => {
            return loadBondingCurve$Data(src.loadRef().beginParse());
        }
    }
}

 type BondingCurve_init_args = {
    $$type: 'BondingCurve_init_args';
    admin: Address;
    jettonMaster: Address;
    feeWallet: Address;
    graduationDestination: Address;
    virtualTon: bigint;
    virtualTokens: bigint;
    tokensForSale: bigint;
    graduationTon: bigint;
    feeBps: bigint;
}

function initBondingCurve_init_args(src: BondingCurve_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.admin);
        b_0.storeAddress(src.jettonMaster);
        b_0.storeAddress(src.feeWallet);
        const b_1 = new Builder();
        b_1.storeAddress(src.graduationDestination);
        b_1.storeInt(src.virtualTon, 257);
        b_1.storeInt(src.virtualTokens, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.tokensForSale, 257);
        b_2.storeInt(src.graduationTon, 257);
        b_2.storeInt(src.feeBps, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

async function BondingCurve_init(admin: Address, jettonMaster: Address, feeWallet: Address, graduationDestination: Address, virtualTon: bigint, virtualTokens: bigint, tokensForSale: bigint, graduationTon: bigint, feeBps: bigint) {
    const __code = Cell.fromHex('b5ee9c7241022c01000d7200025aff008e88f4a413f4bcf2c80bed53208e983001d072d721d200d200fa4021103450666f04f86102f862e1ed43d9010d0202710207020120030402f7b9156ed44d0d200018e36fa40fa40fa40d401d0fa40fa00fa00fa00fa00d30fd430d0d72c01916d93fa4001e201fa00fa00d200f404d33f3010cf10ce10cd6c1f8eb2fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d700810101d7003010691068106709d15507e2550edb3c6cf180e18020275050602f2a811ed44d0d200018e36fa40fa40fa40d401d0fa40fa00fa00fa00fa00d30fd430d0d72c01916d93fa4001e201fa00fa00d200f404d33f3010cf10ce10cd6c1f8eb2fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d700810101d7003010691068106709d15507e2db3c6cf10e2602f6ab42ed44d0d200018e36fa40fa40fa40d401d0fa40fa00fa00fa00fa00d30fd430d0d72c01916d93fa4001e201fa00fa00d200f404d33f3010cf10ce10cd6c1f8eb2fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d700810101d7003010691068106709d15507e2550edb3c6cf10e23020120080c020120090b02f7b4ec5da89a1a400031c6df481f481f481a803a1f481f401f401f401f401a61fa861a1ae580322db27f48003c403f401f401a401e809a67e60219e219c219ad83f1d65f481f481f481a803a1f481020203ae01020203ae01a861a1020203ae01020203ae01020203ae006020d220d020ce13a2aa0fc5b678d932d8d300e0a0012547a945476ba547c8b02f3b52adda89a1a400031c6df481f481f481a803a1f481f401f401f401f401a61fa861a1ae580322db27f48003c403f401f401a401e809a67e60219e219c219ad83f1d65f481f481f481a803a1f481020203ae01020203ae01a861a1020203ae01020203ae01020203ae006020d220d020ce13a2aa0fc5b678d9e300e2502f3b9dcded44d0d200018e36fa40fa40fa40d401d0fa40fa00fa00fa00fa00d30fd430d0d72c01916d93fa4001e201fa00fa00d200f404d33f3010cf10ce10cd6c1f8eb2fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d700810101d7003010691068106709d15507e2db3c6cf180e2403fced44d0d200018e36fa40fa40fa40d401d0fa40fa00fa00fa00fa00d30fd430d0d72c01916d93fa4001e201fa00fa00d200f404d33f3010cf10ce10cd6c1f8eb2fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d700810101d7003010691068106709d15507e21110e302702fd74920c21f0e0f1300a86d7020706d718164c52bc200f2f48158922ac200f2f48200d68529c200f2f48135c1539ab9f2f4812b6328c200f2f481715327c2ff95278103e8bb9170e2f2f453a9a853a9a1a9048200d8ee511ca15290bbf2f402e40e8020d72120d749c1608e493010ce551bc87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed54e0d31f0182100f8a7ea5bde302d33f302e80402259f40f6fa192306ddf101100923010ce551bc87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed5401f8206e92306d9dd0fa40fa00fa0055206c136f03e2206e8e495b10ce551bc87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed54e0206ef2d0806f231111138040f45b305152a1111014a15033727012019a136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010ce10bd10ac109b108a1079106810571046400305041f02fa96310fd31f1110de2182105745544aba8e5f5b0efa403081557df8422fc705f2f481122f056e15f2f410ce551bc87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed54e021821042555921bae30221141501d25b0ed33ffa00300e11100e10df10ce10bd10ac109b108a107910681057104610351024db3cc87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed542102f882107362d09cbae302218210d53276dbba8e675b0ed33f30500e8040f45b3010ce10bd10ac109b108a10791068105710461035440302c87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed54e021161b04fe5b0ed33f31fa00fa4010ef10df10cf10bf10af109f108f107f106f105f104f103f102f011110011111db3c8152b8f84258c705f2f481606323b3f2f48200d7aa5610c200f2f48125a1561025bbf2f4550e1111db3c55e05611db3c5307a8812710a9045ca1814c9021c200f2f420815be01114be01111301f2f481400d532722171819006620d749c101923070e0d20001923070e020d749c120923070e0d31f01821053454c4cbd923070e020d749c104923070e0fa0030038a20c101923070e055e0db3c011110a00fdb3c5610a0a5011110a9040fdb3c011110a120c1009430550d70e010ef10de10cd10bc10ab109a108910781067105610451034413026242502fcbbf2f45066a1111214a124c2008e3b52c57270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb009134e250fe7070036d6d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c901fb0010be291a00b010ad109c108b107a106910581047103610254430c87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed5404fe821047524144ba8ff65b0ed33f3081207622f2f410de10cd10bc10ab109a108910781067105610451034413fdb3c5394a120c200925b3fe30d7024c2008e3b52b57270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb009134e2550d221c1f1e01fe3529821007270e0072706d718b0804111704103b56130356144133c8556082100f8a7ea55008cb1f16cb3f5004fa0212ce01206e9430cf84809201cee2f40001fa02cec91314021113021710246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c91d000a01fb00102e02d4e0218210946a98b6ba8ece5b0ed33f30c8018210aff90f5758cb1fcb3fc910df10ce10bd10ac109b108a107910681057104610354430f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00e05710c0000fc1211fb0e3025f0ff2c0821f200088c87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed5401c870200e11100e10df10ce10bd10ac109b108a107910681057104610351024db3cc87f01ca0055e050efce1cce1ace08c8ce5007fa025005fa025003fa0201fa02cb0fc858206e9430cf84809201cee258fa025003fa0213ca0013f40013cb3fcdcdc9ed542103f43181606324b3f2f455e0db3cf8416f24135f038200c07d2182100ee6b280bcf2f482100ee6b280a15308a8812710a90466a1814c9021c200f2f40e11110e0d11100d10cf0b11110b0a11100a109f0811110807111007106f0511110504111004103f021111020111100151ffdb3c814c9021c200f2f48200ea39222327001853556eb3f2e444206ef2d080038220c101923070e055e0db3c011110a00fdb3c011110a9040fdb3c011110a120c1009430550d70e010ef10de10cd10bc10ab109a1089107810671056104510344130252426024adb3c55e0db3c01111001a810ef10de10cd10bc10ab109a10891078106710561045103441302526000653a4a000065393a101fc5351a02bbbf2f420815be01115be01111401f2f4514fa0035612a05610c2008e3d52c011117270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00925710e223a48040f8420111115614c855205023ce01fa0201fa02c9011110012802fe5250206e953059f45b30944133f417e2821007270e007ff842f8286d718b08106a05111805c8556082100f8a7ea55008cb1f16cb3f5004fa0212ce01206e9430cf84809201cee2f40001fa02cec9031111031024011112017050346d036d5520c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400292a001a58cf8680cf8480f400f400cf810136c901fb0010ae109d108c107b106a1059104810374066050403db3c2b001a22b3935347be9170e2927f33de85014b10');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initBondingCurve_init_args({ $$type: 'BondingCurve_init_args', admin, jettonMaster, feeWallet, graduationDestination, virtualTon, virtualTokens, tokensForSale, graduationTon, feeBps })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const BondingCurve_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
    1092: { message: "jetton wallet not set" },
    4655: { message: "jetton wallet already set" },
    8310: { message: "threshold not reached" },
    9633: { message: "more tokens than sold" },
    11107: { message: "graduationTon must be positive" },
    13761: { message: "tokensForSale must be below virtualTokens" },
    16397: { message: "reserve underflow" },
    19600: { message: "amount too small" },
    21176: { message: "unknown jetton wallet" },
    21885: { message: "only admin" },
    22674: { message: "virtualTokens must be positive" },
    23520: { message: "slippage" },
    24675: { message: "curve graduated" },
    25797: { message: "virtualTon must be positive" },
    29011: { message: "feeBps out of range" },
    49277: { message: "not enough value for gas" },
    54917: { message: "tokensForSale must be positive" },
    55210: { message: "empty transfer" },
    55534: { message: "graduationTon unreachable" },
    59961: { message: "not enough tokens left" },
} as const

export const BondingCurve_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
    "jetton wallet not set": 1092,
    "jetton wallet already set": 4655,
    "threshold not reached": 8310,
    "more tokens than sold": 9633,
    "graduationTon must be positive": 11107,
    "tokensForSale must be below virtualTokens": 13761,
    "reserve underflow": 16397,
    "amount too small": 19600,
    "unknown jetton wallet": 21176,
    "only admin": 21885,
    "virtualTokens must be positive": 22674,
    "slippage": 23520,
    "curve graduated": 24675,
    "virtualTon must be positive": 25797,
    "feeBps out of range": 29011,
    "not enough value for gas": 49277,
    "tokensForSale must be positive": 54917,
    "empty transfer": 55210,
    "graduationTon unreachable": 55534,
    "not enough tokens left": 59961,
} as const

const BondingCurve_types: ABIType[] = [
    {"name":"DataSize","header":null,"fields":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"SignedBundle","header":null,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signedData","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"StateInit","header":null,"fields":[{"name":"code","type":{"kind":"simple","type":"cell","optional":false}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"Context","header":null,"fields":[{"name":"bounceable","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"raw","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"SendParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"data","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"MessageParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"DeployParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}},{"name":"init","type":{"kind":"simple","type":"StateInit","optional":false}}]},
    {"name":"StdAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":8}},{"name":"address","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VarAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":32}},{"name":"address","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"BasechainAddress","header":null,"fields":[{"name":"hash","type":{"kind":"simple","type":"int","optional":true,"format":257}}]},
    {"name":"Deploy","header":2490013878,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"DeployOk","header":2952335191,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FactoryDeploy","header":1829761339,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"cashback","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"JettonTransfer","header":260734629,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"responseDestination","type":{"kind":"simple","type":"address","optional":true}},{"name":"customPayload","type":{"kind":"simple","type":"cell","optional":true}},{"name":"forwardTonAmount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forwardPayload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonTransferNotification","header":1935855772,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"forwardPayload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"Buy","header":1112889633,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"minTokensOut","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}}]},
    {"name":"SetJettonWallet","header":1464161354,"fields":[{"name":"wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"Graduate","header":1196572996,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"JettonExcesses","header":3576854235,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingBuy","header":null,"fields":[{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"ton","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"tokens","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}}]},
    {"name":"CurveData","header":null,"fields":[{"name":"virtualTon","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"virtualTokens","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"realTon","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"tokensSold","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"tokensForSale","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"graduationTon","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"feeBps","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"graduated","type":{"kind":"simple","type":"bool","optional":false}},{"name":"jettonWallet","type":{"kind":"simple","type":"address","optional":true}}]},
    {"name":"BondingCurve$Data","header":null,"fields":[{"name":"admin","type":{"kind":"simple","type":"address","optional":false}},{"name":"jettonMaster","type":{"kind":"simple","type":"address","optional":false}},{"name":"feeWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"graduationDestination","type":{"kind":"simple","type":"address","optional":false}},{"name":"virtualTon","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"virtualTokens","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"tokensForSale","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"graduationTon","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"feeBps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"jettonWallet","type":{"kind":"simple","type":"address","optional":true}},{"name":"realTon","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"tokensSold","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"graduated","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pending","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PendingBuy","valueFormat":"ref"}},{"name":"nextQueryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const BondingCurve_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "JettonTransfer": 260734629,
    "JettonTransferNotification": 1935855772,
    "Buy": 1112889633,
    "SetJettonWallet": 1464161354,
    "Graduate": 1196572996,
    "JettonExcesses": 3576854235,
}

const BondingCurve_getters: ABIGetter[] = [
    {"name":"tonReserve","methodId":108886,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"tokenReserve","methodId":92177,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"k","methodId":122317,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"tokensOutFor","methodId":94018,"arguments":[{"name":"tonIn","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"tonOutFor","methodId":69974,"arguments":[{"name":"tokensIn","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"data","methodId":100194,"arguments":[],"returnType":{"kind":"simple","type":"CurveData","optional":false}},
]

export const BondingCurve_getterMapping: { [key: string]: string } = {
    'tonReserve': 'getTonReserve',
    'tokenReserve': 'getTokenReserve',
    'k': 'getK',
    'tokensOutFor': 'getTokensOutFor',
    'tonOutFor': 'getTonOutFor',
    'data': 'getData',
}

const BondingCurve_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"SetJettonWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Buy"}},
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonTransferNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonExcesses"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Graduate"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]


export class BondingCurve implements Contract {
    
    public static readonly GasBuyOverhead = 250000000n;
    public static readonly GasJettonTransfer = 120000000n;
    public static readonly MinContractBalance = 50000000n;
    public static readonly storageReserve = 0n;
    public static readonly errors = BondingCurve_errors_backward;
    public static readonly opcodes = BondingCurve_opcodes;
    
    static async init(admin: Address, jettonMaster: Address, feeWallet: Address, graduationDestination: Address, virtualTon: bigint, virtualTokens: bigint, tokensForSale: bigint, graduationTon: bigint, feeBps: bigint) {
        return await BondingCurve_init(admin, jettonMaster, feeWallet, graduationDestination, virtualTon, virtualTokens, tokensForSale, graduationTon, feeBps);
    }
    
    static async fromInit(admin: Address, jettonMaster: Address, feeWallet: Address, graduationDestination: Address, virtualTon: bigint, virtualTokens: bigint, tokensForSale: bigint, graduationTon: bigint, feeBps: bigint) {
        const __gen_init = await BondingCurve_init(admin, jettonMaster, feeWallet, graduationDestination, virtualTon, virtualTokens, tokensForSale, graduationTon, feeBps);
        const address = contractAddress(0, __gen_init);
        return new BondingCurve(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new BondingCurve(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  BondingCurve_types,
        getters: BondingCurve_getters,
        receivers: BondingCurve_receivers,
        errors: BondingCurve_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: SetJettonWallet | Buy | null | JettonTransferNotification | JettonExcesses | Graduate | Deploy) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SetJettonWallet') {
            body = beginCell().store(storeSetJettonWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Buy') {
            body = beginCell().store(storeBuy(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'JettonTransferNotification') {
            body = beginCell().store(storeJettonTransferNotification(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'JettonExcesses') {
            body = beginCell().store(storeJettonExcesses(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Graduate') {
            body = beginCell().store(storeGraduate(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getTonReserve(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('tonReserve', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getTokenReserve(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('tokenReserve', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getK(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('k', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getTokensOutFor(provider: ContractProvider, tonIn: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(tonIn);
        const source = (await provider.get('tokensOutFor', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getTonOutFor(provider: ContractProvider, tokensIn: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(tokensIn);
        const source = (await provider.get('tonOutFor', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getData(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('data', builder.build())).stack;
        const result = loadGetterTupleCurveData(source);
        return result;
    }
    
}