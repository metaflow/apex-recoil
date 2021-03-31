interface typeMap { // for mapping from strings to types
    string: string;
    number: number;
    boolean: boolean;
}

type PrimitiveOrConstructor = // 'string' | 'number' | 'boolean' | constructor
    | { new(...args: any[]): any }
    | keyof typeMap;

// infer the guarded type from a specific case of PrimitiveOrConstructor
type GuardedType<T extends PrimitiveOrConstructor> = T extends { new(...args: any[]): infer U; } ? U : T extends keyof typeMap ? typeMap[T] : never;

export function checkT<T extends PrimitiveOrConstructor>(o: any, className: T): o is GuardedType<T> {
    const localPrimitiveOrConstructor: PrimitiveOrConstructor = className;
    if (typeof localPrimitiveOrConstructor === 'string') {
        return typeof o === localPrimitiveOrConstructor;
    }
    return o instanceof localPrimitiveOrConstructor;
}

export function error(...args: any): Error {
    onError(...args);    
    return new Error('error occured');
}

export function onError(...args: any) {
    console.error(...args);
    const c = document.getElementById("error-bar");
    if (c) {
        c.classList.remove('hidden');
        c.innerText = 'Error occured. See console for the details';
    }
}

export function assert(c: boolean, ...args: any) {
    if (c) return;
    console.error('assertion failed', ...args);
    throw new Error('assertion failed');
}

export function clearError() {
    const c = document.getElementById("error-bar");
    if (!c) return;
    c.classList.add('hidden');
}

export function copy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}
