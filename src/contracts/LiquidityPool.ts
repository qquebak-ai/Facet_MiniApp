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

export type PoolBuy = {
    $$type: 'PoolBuy';
    queryId: bigint;
    minTokensOut: bigint;
}

export function storePoolBuy(src: PoolBuy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1346524505, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeCoins(src.minTokensOut);
    };
}

export function loadPoolBuy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1346524505) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _minTokensOut = sc_0.loadCoins();
    return { $$type: 'PoolBuy' as const, queryId: _queryId, minTokensOut: _minTokensOut };
}

export function loadTuplePoolBuy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _minTokensOut = source.readBigNumber();
    return { $$type: 'PoolBuy' as const, queryId: _queryId, minTokensOut: _minTokensOut };
}

export function loadGetterTuplePoolBuy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _minTokensOut = source.readBigNumber();
    return { $$type: 'PoolBuy' as const, queryId: _queryId, minTokensOut: _minTokensOut };
}

export function storeTuplePoolBuy(source: PoolBuy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeNumber(source.minTokensOut);
    return builder.build();
}

export function dictValueParserPoolBuy(): DictionaryValue<PoolBuy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePoolBuy(src)).endCell());
        },
        parse: (src) => {
            return loadPoolBuy(src.loadRef().beginParse());
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

export type SetCurve = {
    $$type: 'SetCurve';
    curve: Address;
}

export function storeSetCurve(src: SetCurve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1396920918, 32);
        b_0.storeAddress(src.curve);
    };
}

export function loadSetCurve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1396920918) { throw Error('Invalid prefix'); }
    const _curve = sc_0.loadAddress();
    return { $$type: 'SetCurve' as const, curve: _curve };
}

export function loadTupleSetCurve(source: TupleReader) {
    const _curve = source.readAddress();
    return { $$type: 'SetCurve' as const, curve: _curve };
}

export function loadGetterTupleSetCurve(source: TupleReader) {
    const _curve = source.readAddress();
    return { $$type: 'SetCurve' as const, curve: _curve };
}

export function storeTupleSetCurve(source: SetCurve) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.curve);
    return builder.build();
}

export function dictValueParserSetCurve(): DictionaryValue<SetCurve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSetCurve(src)).endCell());
        },
        parse: (src) => {
            return loadSetCurve(src.loadRef().beginParse());
        }
    }
}

export type PoolPendingBuy = {
    $$type: 'PoolPendingBuy';
    buyer: Address;
    ton: bigint;
    tokens: bigint;
    failed: boolean;
}

export function storePoolPendingBuy(src: PoolPendingBuy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.buyer);
        b_0.storeCoins(src.ton);
        b_0.storeCoins(src.tokens);
        b_0.storeBit(src.failed);
    };
}

export function loadPoolPendingBuy(slice: Slice) {
    const sc_0 = slice;
    const _buyer = sc_0.loadAddress();
    const _ton = sc_0.loadCoins();
    const _tokens = sc_0.loadCoins();
    const _failed = sc_0.loadBit();
    return { $$type: 'PoolPendingBuy' as const, buyer: _buyer, ton: _ton, tokens: _tokens, failed: _failed };
}

export function loadTuplePoolPendingBuy(source: TupleReader) {
    const _buyer = source.readAddress();
    const _ton = source.readBigNumber();
    const _tokens = source.readBigNumber();
    const _failed = source.readBoolean();
    return { $$type: 'PoolPendingBuy' as const, buyer: _buyer, ton: _ton, tokens: _tokens, failed: _failed };
}

export function loadGetterTuplePoolPendingBuy(source: TupleReader) {
    const _buyer = source.readAddress();
    const _ton = source.readBigNumber();
    const _tokens = source.readBigNumber();
    const _failed = source.readBoolean();
    return { $$type: 'PoolPendingBuy' as const, buyer: _buyer, ton: _ton, tokens: _tokens, failed: _failed };
}

export function storeTuplePoolPendingBuy(source: PoolPendingBuy) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.buyer);
    builder.writeNumber(source.ton);
    builder.writeNumber(source.tokens);
    builder.writeBoolean(source.failed);
    return builder.build();
}

export function dictValueParserPoolPendingBuy(): DictionaryValue<PoolPendingBuy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePoolPendingBuy(src)).endCell());
        },
        parse: (src) => {
            return loadPoolPendingBuy(src.loadRef().beginParse());
        }
    }
}

export type PoolData = {
    $$type: 'PoolData';
    tonReserve: bigint;
    tokenReserve: bigint;
    feeBps: bigint;
    ready: boolean;
    curve: Address | null;
    jettonMaster: Address;
    jettonWallet: Address | null;
}

export function storePoolData(src: PoolData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.tonReserve, 257);
        b_0.storeInt(src.tokenReserve, 257);
        b_0.storeInt(src.feeBps, 257);
        b_0.storeBit(src.ready);
        const b_1 = new Builder();
        b_1.storeAddress(src.curve);
        b_1.storeAddress(src.jettonMaster);
        b_1.storeAddress(src.jettonWallet);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPoolData(slice: Slice) {
    const sc_0 = slice;
    const _tonReserve = sc_0.loadIntBig(257);
    const _tokenReserve = sc_0.loadIntBig(257);
    const _feeBps = sc_0.loadIntBig(257);
    const _ready = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _curve = sc_1.loadMaybeAddress();
    const _jettonMaster = sc_1.loadAddress();
    const _jettonWallet = sc_1.loadMaybeAddress();
    return { $$type: 'PoolData' as const, tonReserve: _tonReserve, tokenReserve: _tokenReserve, feeBps: _feeBps, ready: _ready, curve: _curve, jettonMaster: _jettonMaster, jettonWallet: _jettonWallet };
}

export function loadTuplePoolData(source: TupleReader) {
    const _tonReserve = source.readBigNumber();
    const _tokenReserve = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _ready = source.readBoolean();
    const _curve = source.readAddressOpt();
    const _jettonMaster = source.readAddress();
    const _jettonWallet = source.readAddressOpt();
    return { $$type: 'PoolData' as const, tonReserve: _tonReserve, tokenReserve: _tokenReserve, feeBps: _feeBps, ready: _ready, curve: _curve, jettonMaster: _jettonMaster, jettonWallet: _jettonWallet };
}

export function loadGetterTuplePoolData(source: TupleReader) {
    const _tonReserve = source.readBigNumber();
    const _tokenReserve = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _ready = source.readBoolean();
    const _curve = source.readAddressOpt();
    const _jettonMaster = source.readAddress();
    const _jettonWallet = source.readAddressOpt();
    return { $$type: 'PoolData' as const, tonReserve: _tonReserve, tokenReserve: _tokenReserve, feeBps: _feeBps, ready: _ready, curve: _curve, jettonMaster: _jettonMaster, jettonWallet: _jettonWallet };
}

export function storeTuplePoolData(source: PoolData) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.tonReserve);
    builder.writeNumber(source.tokenReserve);
    builder.writeNumber(source.feeBps);
    builder.writeBoolean(source.ready);
    builder.writeAddress(source.curve);
    builder.writeAddress(source.jettonMaster);
    builder.writeAddress(source.jettonWallet);
    return builder.build();
}

export function dictValueParserPoolData(): DictionaryValue<PoolData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePoolData(src)).endCell());
        },
        parse: (src) => {
            return loadPoolData(src.loadRef().beginParse());
        }
    }
}

export type LiquidityPool$Data = {
    $$type: 'LiquidityPool$Data';
    admin: Address;
    jettonMaster: Address;
    feeWallet: Address;
    feeBps: bigint;
    jettonWallet: Address | null;
    curve: Address | null;
    tonReserve: bigint;
    tokenReserve: bigint;
    tonFunded: boolean;
    tokensFunded: boolean;
    pending: Dictionary<bigint, PoolPendingBuy>;
    nextQueryId: bigint;
}

export function storeLiquidityPool$Data(src: LiquidityPool$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.admin);
        b_0.storeAddress(src.jettonMaster);
        b_0.storeAddress(src.feeWallet);
        b_0.storeUint(src.feeBps, 16);
        const b_1 = new Builder();
        b_1.storeAddress(src.jettonWallet);
        b_1.storeAddress(src.curve);
        b_1.storeCoins(src.tonReserve);
        b_1.storeCoins(src.tokenReserve);
        b_1.storeBit(src.tonFunded);
        b_1.storeBit(src.tokensFunded);
        b_1.storeDict(src.pending, Dictionary.Keys.BigUint(64), dictValueParserPoolPendingBuy());
        b_1.storeUint(src.nextQueryId, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadLiquidityPool$Data(slice: Slice) {
    const sc_0 = slice;
    const _admin = sc_0.loadAddress();
    const _jettonMaster = sc_0.loadAddress();
    const _feeWallet = sc_0.loadAddress();
    const _feeBps = sc_0.loadUintBig(16);
    const sc_1 = sc_0.loadRef().beginParse();
    const _jettonWallet = sc_1.loadMaybeAddress();
    const _curve = sc_1.loadMaybeAddress();
    const _tonReserve = sc_1.loadCoins();
    const _tokenReserve = sc_1.loadCoins();
    const _tonFunded = sc_1.loadBit();
    const _tokensFunded = sc_1.loadBit();
    const _pending = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserPoolPendingBuy(), sc_1);
    const _nextQueryId = sc_1.loadUintBig(64);
    return { $$type: 'LiquidityPool$Data' as const, admin: _admin, jettonMaster: _jettonMaster, feeWallet: _feeWallet, feeBps: _feeBps, jettonWallet: _jettonWallet, curve: _curve, tonReserve: _tonReserve, tokenReserve: _tokenReserve, tonFunded: _tonFunded, tokensFunded: _tokensFunded, pending: _pending, nextQueryId: _nextQueryId };
}

export function loadTupleLiquidityPool$Data(source: TupleReader) {
    const _admin = source.readAddress();
    const _jettonMaster = source.readAddress();
    const _feeWallet = source.readAddress();
    const _feeBps = source.readBigNumber();
    const _jettonWallet = source.readAddressOpt();
    const _curve = source.readAddressOpt();
    const _tonReserve = source.readBigNumber();
    const _tokenReserve = source.readBigNumber();
    const _tonFunded = source.readBoolean();
    const _tokensFunded = source.readBoolean();
    const _pending = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPoolPendingBuy(), source.readCellOpt());
    const _nextQueryId = source.readBigNumber();
    return { $$type: 'LiquidityPool$Data' as const, admin: _admin, jettonMaster: _jettonMaster, feeWallet: _feeWallet, feeBps: _feeBps, jettonWallet: _jettonWallet, curve: _curve, tonReserve: _tonReserve, tokenReserve: _tokenReserve, tonFunded: _tonFunded, tokensFunded: _tokensFunded, pending: _pending, nextQueryId: _nextQueryId };
}

export function loadGetterTupleLiquidityPool$Data(source: TupleReader) {
    const _admin = source.readAddress();
    const _jettonMaster = source.readAddress();
    const _feeWallet = source.readAddress();
    const _feeBps = source.readBigNumber();
    const _jettonWallet = source.readAddressOpt();
    const _curve = source.readAddressOpt();
    const _tonReserve = source.readBigNumber();
    const _tokenReserve = source.readBigNumber();
    const _tonFunded = source.readBoolean();
    const _tokensFunded = source.readBoolean();
    const _pending = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPoolPendingBuy(), source.readCellOpt());
    const _nextQueryId = source.readBigNumber();
    return { $$type: 'LiquidityPool$Data' as const, admin: _admin, jettonMaster: _jettonMaster, feeWallet: _feeWallet, feeBps: _feeBps, jettonWallet: _jettonWallet, curve: _curve, tonReserve: _tonReserve, tokenReserve: _tokenReserve, tonFunded: _tonFunded, tokensFunded: _tokensFunded, pending: _pending, nextQueryId: _nextQueryId };
}

export function storeTupleLiquidityPool$Data(source: LiquidityPool$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.admin);
    builder.writeAddress(source.jettonMaster);
    builder.writeAddress(source.feeWallet);
    builder.writeNumber(source.feeBps);
    builder.writeAddress(source.jettonWallet);
    builder.writeAddress(source.curve);
    builder.writeNumber(source.tonReserve);
    builder.writeNumber(source.tokenReserve);
    builder.writeBoolean(source.tonFunded);
    builder.writeBoolean(source.tokensFunded);
    builder.writeCell(source.pending.size > 0 ? beginCell().storeDictDirect(source.pending, Dictionary.Keys.BigUint(64), dictValueParserPoolPendingBuy()).endCell() : null);
    builder.writeNumber(source.nextQueryId);
    return builder.build();
}

export function dictValueParserLiquidityPool$Data(): DictionaryValue<LiquidityPool$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeLiquidityPool$Data(src)).endCell());
        },
        parse: (src) => {
            return loadLiquidityPool$Data(src.loadRef().beginParse());
        }
    }
}

 type LiquidityPool_init_args = {
    $$type: 'LiquidityPool_init_args';
    admin: Address;
    jettonMaster: Address;
    feeWallet: Address;
    feeBps: bigint;
}

function initLiquidityPool_init_args(src: LiquidityPool_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.admin);
        b_0.storeAddress(src.jettonMaster);
        b_0.storeAddress(src.feeWallet);
        const b_1 = new Builder();
        b_1.storeInt(src.feeBps, 257);
        b_0.storeRef(b_1.endCell());
    };
}

async function LiquidityPool_init(admin: Address, jettonMaster: Address, feeWallet: Address, feeBps: bigint) {
    const __code = Cell.fromHex('b5ee9c7241022601000c2d00025aff008e88f4a413f4bcf2c80bed53208e983001d072d721d200d200fa4021103450666f04f86102f862e1ed43d9010b02027102070201200306020120040501f5b62adda89a1a400031c71f481f481f481a61fa803a1ae580322db27f48003c403ae580322db27f48003c403f401f401a401a401e809a67e602118211621142112d8391c5ff481f481f481a803a1020203ae006028866009a2aa04dadae040e0e0dae302e2a65385ff2a530207d17722e1c5e5e9c4aa17b678d98301901f1b7133da89a1a400031c71f481f481f481a61fa803a1ae580322db27f48003c403ae580322db27f48003c403f401f401a401a401e809a67e602118211621142112d8391c5ff481f481f481a803a1020203ae006028866009a2aa04dadae040e0e0dae302e2a65385ff2a530207d17722e1c5e5e9c5b678d98302201f5baf42ed44d0d200018e38fa40fa40fa40d30fd401d0d72c01916d93fa4001e201d72c01916d93fa4001e201fa00fa00d200d200f404d33f30108c108b108a10896c1c8e2ffa40fa40fa40d401d0810101d7003014433004d155026d6d702070706d7181715329c2ff95298103e8bb9170e2f2f4e2550bdb3c6cc1821020120080a01f1b8762ed44d0d200018e38fa40fa40fa40d30fd401d0d72c01916d93fa4001e201d72c01916d93fa4001e201fa00fa00d200d200f404d33f30108c108b108a10896c1c8e2ffa40fa40fa40d401d0810101d7003014433004d155026d6d702070706d7181715329c2ff95298103e8bb9170e2f2f4e2db3c6cc7809014c54754855b2db3c103f4ed05477b80f11120f0e11110e0d11100d10cf10be10ad109c108b107a2201f1b9dcded44d0d200018e38fa40fa40fa40d30fd401d0d72c01916d93fa4001e201d72c01916d93fa4001e201fa00fa00d200d200f404d33f30108c108b108a10896c1c8e2ffa40fa40fa40d401d0810101d7003014433004d155026d6d702070706d7181715329c2ff95298103e8bb9170e2f2f4e2db3c6cc182303feed44d0d200018e38fa40fa40fa40d30fd401d0d72c01916d93fa4001e201d72c01916d93fa4001e201fa00fa00d200d200f404d33f30108c108b108a10896c1c8e2ffa40fa40fa40d401d0810101d7003014433004d155026d6d702070706d7181715329c2ff95298103e8bb9170e2f2f4e20de302702cd74920c21fe300210c101102de0b8020d72120d749c1608e4630109b5518c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed54e0d31f0182100f8a7ea5bde302d33f302b80402259f40f6fa192306ddf0d0e008c30109b5518c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed5401f4206e92306d9fd0fa40fa00fa00d20055306c146f04e2206e8e465b109b5518c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed54e0206ef2d0806f2430503e8040f45b305162a1505da0504472700f018e136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00109b108a1079106810571046104540341c000a310cd31f0d03f682105745544aba8e5c5b0bfa403081557df8422cc705f2f481122f076e17f2f4109b5518c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed54e021821053435256bae30221821050425559bae3022112131400ba5b0bfa403081557df8422cc705f2f482009d43066e16f2f4109b5518c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed5401bc5b0bd33f31fa003010ac109b108a10791068105710461035443012db3cc87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed541f03fe82107362d09cbae302218210d53276dbba8e5d5b0bd33f30500b8040f45b30109b108a107910681057104610354403c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed54e0218210946a98b6bae3023dc0000c151b1d04d65b0bd33f31fa00fa4010bc10ac109c108c107c106c105c104c103c4cdedb3c8152b8f84258c705f2f48200d7aa2dc200f2f422b393266eb39170e29a26206ef2d08052e0c7059170e2e30255a08200b8880cdb3c1df2f410ac109b108a107910681057104610354014503e20162217009c323c3c09a0107a106955257f02c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed5403f6db3c55b02edb3c5309a8812710a9045ca1814c9021c200f2f420815be01111be01111001f2f48200b1875328b9f2f45077a1505fa025c2008e3b52967270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb009135e250cb7018191a006620d749c101923070e0d20001923070e020d749c120923070e0d31f01821053454c4cbd923070e020d749c104923070e0fa003002aa20c101917f8e9b55b0db3cb310cd10bc10ab109a1089107810671056104510344130e2923070e05250a055b0db3c2da0a5500da9045250a120c1009430550a70e010bc10ab109a10891078106710561045103441302223018e70036d6d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00108b107a106910581047103644331c01925b0bd33f30c8018210aff90f5758cb1fcb3fc910ac109b108a10791068105710461035443012f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001c0082c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed5402dac1211cb08f61246eb39af84225206ef2d080c7059170e29221b39170e2e302109b551870db3cc87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed54e05f0cf2c0821e1f00d431f8416f24135f03820afaf080a1816f7121c200f2f413a0108a1079106810571046103550347f5520c87f01ca0055b050bcce19ce17ce15cb0fc85004206e9430cf84809201cee258206e9430cf84809201cee201fa0258fa0212ca0012ca0012f40012cb3fcdc9ed5404f010ac5e38107b106c105b104c103b4cbc8200b8880cdb3c1df2f4550adb3cf8416f24135f038200c07d21821007270e00bcf2f4821007270e00a1530aa8812710a90466a1814c9021c200f2f455b22cdb3c814c9021c200f2f48200b1875316b9f2f420815be01112be01111101f2f4515ca0514fa12dc20022202124001853776eb3f2e444206ef2d08002a420c101917f8e9b55b0db3cb310cd10bc10ab109a1089107810671056104510344130e2923070e05260a055b0db3c500da9045240a120c1009430550a70e010bc10ab109a1089107810671056104510344130222300282391229170e29325c2009170e29324c2009170e200065354a801fc8e3b529e7270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00913de224a48040f842500e561170c855305034ce01fa0201fa02ca00c9542d60206e953059f45b30944133f417e2821004c4b4007ff842f8286d7070c8ca00c9d02500f2106b05111505c8556082100f8a7ea55008cb1f16cb3f5004fa0212ce01206e9430cf84809201cee2f40001fa02cec9103e45f07050346d036d5520c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00107b106a10591048103746154134d87828ac');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initLiquidityPool_init_args({ $$type: 'LiquidityPool_init_args', admin, jettonMaster, feeWallet, feeBps })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const LiquidityPool_errors = {
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
    19600: { message: "amount too small" },
    21176: { message: "unknown jetton wallet" },
    21885: { message: "only admin" },
    23520: { message: "slippage" },
    28529: { message: "liquidity too small" },
    29011: { message: "feeBps out of range" },
    40259: { message: "curve already set" },
    45447: { message: "not enough liquidity" },
    47240: { message: "pool not ready" },
    49277: { message: "not enough value for gas" },
    55210: { message: "empty transfer" },
} as const

export const LiquidityPool_errors_backward = {
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
    "amount too small": 19600,
    "unknown jetton wallet": 21176,
    "only admin": 21885,
    "slippage": 23520,
    "liquidity too small": 28529,
    "feeBps out of range": 29011,
    "curve already set": 40259,
    "not enough liquidity": 45447,
    "pool not ready": 47240,
    "not enough value for gas": 49277,
    "empty transfer": 55210,
} as const

const LiquidityPool_types: ABIType[] = [
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
    {"name":"JettonExcesses","header":3576854235,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PoolBuy","header":1346524505,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"minTokensOut","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}}]},
    {"name":"SetJettonWallet","header":1464161354,"fields":[{"name":"wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SetCurve","header":1396920918,"fields":[{"name":"curve","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PoolPendingBuy","header":null,"fields":[{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"ton","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"tokens","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"failed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"PoolData","header":null,"fields":[{"name":"tonReserve","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"tokenReserve","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"feeBps","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ready","type":{"kind":"simple","type":"bool","optional":false}},{"name":"curve","type":{"kind":"simple","type":"address","optional":true}},{"name":"jettonMaster","type":{"kind":"simple","type":"address","optional":false}},{"name":"jettonWallet","type":{"kind":"simple","type":"address","optional":true}}]},
    {"name":"LiquidityPool$Data","header":null,"fields":[{"name":"admin","type":{"kind":"simple","type":"address","optional":false}},{"name":"jettonMaster","type":{"kind":"simple","type":"address","optional":false}},{"name":"feeWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"feeBps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"jettonWallet","type":{"kind":"simple","type":"address","optional":true}},{"name":"curve","type":{"kind":"simple","type":"address","optional":true}},{"name":"tonReserve","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"tokenReserve","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"tonFunded","type":{"kind":"simple","type":"bool","optional":false}},{"name":"tokensFunded","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pending","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PoolPendingBuy","valueFormat":"ref"}},{"name":"nextQueryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const LiquidityPool_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "JettonTransfer": 260734629,
    "JettonTransferNotification": 1935855772,
    "JettonExcesses": 3576854235,
    "PoolBuy": 1346524505,
    "SetJettonWallet": 1464161354,
    "SetCurve": 1396920918,
}

const LiquidityPool_getters: ABIGetter[] = [
    {"name":"k","methodId":122317,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"ready","methodId":80025,"arguments":[],"returnType":{"kind":"simple","type":"bool","optional":false}},
    {"name":"tokensOutFor","methodId":94018,"arguments":[{"name":"tonIn","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"tonOutFor","methodId":69974,"arguments":[{"name":"tokensIn","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"data","methodId":100194,"arguments":[],"returnType":{"kind":"simple","type":"PoolData","optional":false}},
]

export const LiquidityPool_getterMapping: { [key: string]: string } = {
    'k': 'getK',
    'ready': 'getReady',
    'tokensOutFor': 'getTokensOutFor',
    'tonOutFor': 'getTonOutFor',
    'data': 'getData',
}

const LiquidityPool_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"SetJettonWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SetCurve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PoolBuy"}},
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonTransferNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonExcesses"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]


export class LiquidityPool implements Contract {
    
    public static readonly GasBuyOverhead = 120000000n;
    public static readonly GasJettonTransfer = 80000000n;
    public static readonly MinContractBalance = 50000000n;
    public static readonly storageReserve = 0n;
    public static readonly errors = LiquidityPool_errors_backward;
    public static readonly opcodes = LiquidityPool_opcodes;
    
    static async init(admin: Address, jettonMaster: Address, feeWallet: Address, feeBps: bigint) {
        return await LiquidityPool_init(admin, jettonMaster, feeWallet, feeBps);
    }
    
    static async fromInit(admin: Address, jettonMaster: Address, feeWallet: Address, feeBps: bigint) {
        const __gen_init = await LiquidityPool_init(admin, jettonMaster, feeWallet, feeBps);
        const address = contractAddress(0, __gen_init);
        return new LiquidityPool(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new LiquidityPool(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  LiquidityPool_types,
        getters: LiquidityPool_getters,
        receivers: LiquidityPool_receivers,
        errors: LiquidityPool_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: SetJettonWallet | SetCurve | PoolBuy | null | JettonTransferNotification | JettonExcesses | Deploy) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SetJettonWallet') {
            body = beginCell().store(storeSetJettonWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SetCurve') {
            body = beginCell().store(storeSetCurve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PoolBuy') {
            body = beginCell().store(storePoolBuy(message)).endCell();
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getK(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('k', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getReady(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('ready', builder.build())).stack;
        const result = source.readBoolean();
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
        const result = loadGetterTuplePoolData(source);
        return result;
    }
    
}