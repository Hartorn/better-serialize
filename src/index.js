/* globals window */
const builtInsErrors = [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError];

const globalObj = typeof (window) !== 'undefined' ? window : typeof (global) !== 'undefined' ? global : null;

const buildSimpleObject = elt => (
    Object.keys(elt).forEach((ret, key) => {
        // eslint-disable-next-line no-param-reassign
        ret[key] = elt[key];
        return ret;
    }, {}));
s
const getTypeByName = (name) => {
    const namespaces = name.split('.');
    const funcName = namespaces.pop();
    let funcContext = globalObj;
    namespaces.forEach((ctxName) => {
        funcContext = funcContext[ctxName];
    });
    return funcContext[funcName];
};

const createInstanceByName = (name) => {
    const Type = getTypeByName(name);
    return new Type();
};

const checkType = (obj, type) => obj instanceof type && obj.constructor.name === type.prototype.constructor.name;

const buildAndAssign = (type, properties) => {
    const elt = createInstanceByName(type);
    Object.keys(properties).forEach((prop) => {
        // No need for recursivity, since reviver goes from deep to shallow
        elt[prop] = properties[prop];
    });
    return elt;
};

const regexReplacer = (key, { source, flags }) => {
    return { __typeSerialised: 'RegExp', source, flags };
};

const regexReviver = (key, { source, flags }) => new RegExp(source, flags);

const genericReplacer = (key, obj) => {
    return { ...buildSimpleObject(obj), __typeSerialised: obj.constructor.name };
};

const genericReviver = (key, { __typeSerialised: typename, ...others }) => buildAndAssign(typename, others);

const setReplacer = (key, value) => {
    return { __typeSerialised: 'Set', values: value.values() };
};

const setReviver = (key, { values }) => new Set(values);

const mapReplacer = (key, value) => {
    return { __typeSerialised: 'Map', entries: value.entries() };
};

const mapReviver = (key, { entries }) => new Map(entries);

class Serializer {
    constructor() {
        this.directory = new Map();
        this.register = this.register.bind(this);
        this.__replacer = this.__replacer.bind(this);
        this.__reviver = this.__reviver.bind(this);
        this.serialize = this.serialize.bind(this);
        this.deserialize = this.deserialize.bind(this);
    }

    register(type, replacer, reviver) {
        if (this.directory.has(type)) {
            throw new Error(`${type} is already declared`);
        }
        this.directory.set(type, { replacer, reviver });
    }

    __replacer(key, value) {
        const type = value ? value.constructor : null;
        return this.directory.has(type) ? this.directory.get(type).replacer(key, value) : value;
    }

    __reviver(key, value) {
        if (typeof (value) !== 'object' || !('__typeSerialised' in value)) {
            return value;
        }
        // eslint-disable-next-line no-underscore-dangle
        const elt = getTypeByName(value.__typeSerialised);
        if (this.directory.has(elt)) {
            return this.directory.get(elt).reviver(key, value);
        }
        return value;
    }

    serialize(obj) {
        return JSON.stringify(obj, this.__replacer);
    }

    deserialize(strValue) {
        return JSON.parse(strValue, this.__reviver);
    }
}

export default Serializer;

export const standard = () => {
    const instance = new Serializer();
    instance.register(RegExp, regexReplacer, regexReviver);
    builtInsErrors.forEach(errorType => instance.register(errorType, genericReplacer, genericReviver));
    instance.register(Set, setReplacer, setReviver);
    instance.register(Map, mapReplacer, mapReviver);
    return instance;
};
