// Operational Transformation Engine for Code Synchronization
// Pure, framework-agnostic OT logic extracted from app.js

/** A single OT operation: positive number = retain, negative number = delete, string = insert */
export type Op = number | string;

export class TextOperation {
    ops: Op[];

    constructor() {
        this.ops = [];
    }

    retain(n: number): this {
        if (n === 0) return this;
        const last = this.ops.length - 1;
        // Only combine with positive numbers (other retains), not negative (deletes)
        if (this.ops.length > 0 && typeof this.ops[last] === 'number' && (this.ops[last] as number) > 0) {
            this.ops[last] = (this.ops[last] as number) + n;
        } else {
            this.ops.push(n);
        }
        return this;
    }

    insert(text: string): this {
        if (text === '') return this;
        const last = this.ops.length - 1;
        if (typeof this.ops[last] === 'string') {
            this.ops[last] = (this.ops[last] as string) + text;
        } else {
            this.ops.push(text);
        }
        return this;
    }

    delete(n: number): this {
        if (n === 0) return this;
        if (n > 0) n = -n;
        const last = this.ops.length - 1;
        if (typeof this.ops[last] === 'number' && (this.ops[last] as number) < 0) {
            this.ops[last] = (this.ops[last] as number) + n;
        } else {
            this.ops.push(n);
        }
        return this;
    }

    apply(text: string): string {
        let result = '';
        let pos = 0;

        for (const op of this.ops) {
            if (typeof op === 'number') {
                if (op > 0) {
                    // Retain
                    result += text.slice(pos, pos + op);
                    pos += op;
                } else {
                    // Delete
                    pos += -op;
                }
            } else {
                // Insert
                result += op;
            }
        }

        result += text.slice(pos);
        return result;
    }

    // Transform two operations for concurrent editing
    static transform(op1: TextOperation, op2: TextOperation): [TextOperation, TextOperation] {
        const newOp1 = new TextOperation();
        const newOp2 = new TextOperation();

        let i1 = 0, i2 = 0;
        const ops1 = op1.ops.slice();
        const ops2 = op2.ops.slice();

        while (i1 < ops1.length || i2 < ops2.length) {
            const o1 = ops1[i1];
            const o2 = ops2[i2];

            if (i1 >= ops1.length) {
                newOp2.ops.push(o2);
                i2++;
                continue;
            }

            if (i2 >= ops2.length) {
                newOp1.ops.push(o1);
                i1++;
                continue;
            }

            // Both retain
            if (typeof o1 === 'number' && o1 > 0 && typeof o2 === 'number' && o2 > 0) {
                if (o1 > o2) {
                    newOp1.retain(o2);
                    newOp2.retain(o2);
                    ops1[i1] = (ops1[i1] as number) - o2;
                    i2++;
                } else if (o1 < o2) {
                    newOp1.retain(o1);
                    newOp2.retain(o1);
                    ops2[i2] = (ops2[i2] as number) - o1;
                    i1++;
                } else {
                    newOp1.retain(o1);
                    newOp2.retain(o2);
                    i1++;
                    i2++;
                }
            }
            // Insert from op1
            else if (typeof o1 === 'string') {
                newOp1.insert(o1);
                newOp2.retain(o1.length);
                i1++;
            }
            // Insert from op2
            else if (typeof o2 === 'string') {
                newOp1.retain(o2.length);
                newOp2.insert(o2);
                i2++;
            }
            // Delete from op1, retain from op2
            else if (typeof o1 === 'number' && o1 < 0 && typeof o2 === 'number' && o2 > 0) {
                if (-o1 > o2) {
                    newOp1.delete(o2);
                    ops1[i1] = (ops1[i1] as number) + o2;
                    i2++;
                } else if (-o1 < o2) {
                    newOp1.delete(-o1);
                    ops2[i2] = (ops2[i2] as number) - (-o1);
                    i1++;
                } else {
                    newOp1.delete(-o1);
                    i1++;
                    i2++;
                }
            }
            // Retain from op1, delete from op2
            else if (typeof o1 === 'number' && o1 > 0 && typeof o2 === 'number' && o2 < 0) {
                if (o1 > -o2) {
                    newOp2.delete(-o2);
                    ops1[i1] = (ops1[i1] as number) - (-o2);
                    i2++;
                } else if (o1 < -o2) {
                    newOp2.delete(o1);
                    ops2[i2] = (ops2[i2] as number) + o1;
                    i1++;
                } else {
                    newOp2.delete(-o2);
                    i1++;
                    i2++;
                }
            }
            // Both delete - overlapping deletes consume each other
            else if (typeof o1 === 'number' && o1 < 0 && typeof o2 === 'number' && o2 < 0) {
                if (-o1 > -o2) {
                    // op1 deletes more, consume op2's delete from op1
                    ops1[i1] = (ops1[i1] as number) - o2;  // Subtract negative = reduce delete count
                    i2++;
                } else if (-o1 < -o2) {
                    // op2 deletes more, consume op1's delete from op2
                    ops2[i2] = (ops2[i2] as number) - o1;  // Subtract negative = reduce delete count
                    i1++;
                } else {
                    // Equal deletes, both fully consumed
                    i1++;
                    i2++;
                }
            }
        }

        return [newOp1, newOp2];
    }
}

// Calculate text operation from old to new text
export function calculateTextOperation(oldText: string, newText: string): TextOperation {
    const op = new TextOperation();

    // Simple diff algorithm
    let i = 0;
    let j = 0;

    // Find common prefix
    while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) {
        i++;
    }

    // Find common suffix
    while (j < oldText.length - i && j < newText.length - i &&
           oldText[oldText.length - 1 - j] === newText[newText.length - 1 - j]) {
        j++;
    }

    // Build operation
    if (i > 0) {
        op.retain(i);
    }

    const deletedLength = oldText.length - i - j;
    if (deletedLength > 0) {
        op.delete(deletedLength);
    }

    const insertedText = newText.slice(i, newText.length - j);
    if (insertedText.length > 0) {
        op.insert(insertedText);
    }

    if (j > 0) {
        op.retain(j);
    }

    return op;
}
