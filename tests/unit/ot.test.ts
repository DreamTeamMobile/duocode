/**
 * Operational Transformation Unit Tests
 *
 * Tests for TextOperation class and OT transformation logic.
 * OT is critical for real-time collaborative editing.
 */

import { describe, it, expect } from 'vitest';
import { TextOperation, calculateTextOperation } from '../../src/services/ot-engine';

describe('TextOperation - Basic Operations', () => {
  describe('retain()', () => {
    it('should add retain operation', () => {
      const op = new TextOperation();
      op.retain(5);
      expect(op.ops).toEqual([5]);
    });

    it('should merge consecutive retains', () => {
      const op = new TextOperation();
      op.retain(3).retain(2);
      expect(op.ops).toEqual([5]);
    });

    it('should ignore retain(0)', () => {
      const op = new TextOperation();
      op.retain(0);
      expect(op.ops).toEqual([]);
    });

    it('should handle large retain values', () => {
      const op = new TextOperation();
      op.retain(10000);
      expect(op.ops).toEqual([10000]);
    });
  });

  describe('insert()', () => {
    it('should add insert operation', () => {
      const op = new TextOperation();
      op.insert('hello');
      expect(op.ops).toEqual(['hello']);
    });

    it('should merge consecutive inserts', () => {
      const op = new TextOperation();
      op.insert('hello').insert(' world');
      expect(op.ops).toEqual(['hello world']);
    });

    it('should ignore empty insert', () => {
      const op = new TextOperation();
      op.insert('');
      expect(op.ops).toEqual([]);
    });

    it('should handle unicode characters', () => {
      const op = new TextOperation();
      op.insert('你好🌍');
      expect(op.ops).toEqual(['你好🌍']);
    });

    it('should handle newlines', () => {
      const op = new TextOperation();
      op.insert('line1\nline2');
      expect(op.ops).toEqual(['line1\nline2']);
    });
  });

  describe('delete()', () => {
    it('should add delete operation as negative number', () => {
      const op = new TextOperation();
      op.delete(3);
      expect(op.ops).toEqual([-3]);
    });

    it('should merge consecutive deletes', () => {
      const op = new TextOperation();
      op.delete(2).delete(3);
      expect(op.ops).toEqual([-5]);
    });

    it('should ignore delete(0)', () => {
      const op = new TextOperation();
      op.delete(0);
      expect(op.ops).toEqual([]);
    });

    it('should handle positive number (convert to negative)', () => {
      const op = new TextOperation();
      op.delete(5);
      expect(op.ops).toEqual([-5]);
    });
  });

  describe('mixed operations', () => {
    it('should not merge different operation types', () => {
      const op = new TextOperation();
      op.retain(5).insert('X').delete(2);
      expect(op.ops).toEqual([5, 'X', -2]);
    });

    it('should support method chaining', () => {
      const op = new TextOperation();
      const result = op.retain(5).insert('X').delete(2);
      expect(result).toBe(op);
    });
  });
});

describe('TextOperation - apply()', () => {
  it('should apply retain operation', () => {
    const op = new TextOperation();
    op.retain(5);
    expect(op.apply('Hello World')).toBe('Hello World');
  });

  it('should apply insert at beginning', () => {
    const op = new TextOperation();
    op.insert('Prefix ');
    expect(op.apply('Hello')).toBe('Prefix Hello');
  });

  it('should apply insert in middle', () => {
    const op = new TextOperation();
    op.retain(5).insert(' Beautiful');
    expect(op.apply('Hello World')).toBe('Hello Beautiful World');
  });

  it('should apply insert at end', () => {
    const op = new TextOperation();
    op.retain(5).insert('!');
    expect(op.apply('Hello')).toBe('Hello!');
  });

  it('should apply delete at beginning', () => {
    const op = new TextOperation();
    op.delete(6);
    expect(op.apply('Hello World')).toBe('World');
  });

  it('should apply delete in middle', () => {
    const op = new TextOperation();
    op.retain(5).delete(1);
    expect(op.apply('Hello World')).toBe('HelloWorld');
  });

  it('should apply delete at end', () => {
    const op = new TextOperation();
    op.retain(5).delete(6);
    expect(op.apply('Hello World')).toBe('Hello');
  });

  it('should apply complex operation', () => {
    const op = new TextOperation();
    op.retain(5).delete(1).insert('!');
    expect(op.apply('Hello World')).toBe('Hello!World');
  });

  it('should apply replacement operation', () => {
    const op = new TextOperation();
    op.retain(6).delete(5).insert('Universe');
    expect(op.apply('Hello World')).toBe('Hello Universe');
  });

  it('should handle empty text', () => {
    const op = new TextOperation();
    op.insert('Hello');
    expect(op.apply('')).toBe('Hello');
  });

  it('should handle operation on empty text with retain', () => {
    const op = new TextOperation();
    expect(op.apply('')).toBe('');
  });
});

describe('TextOperation - transform()', () => {
  describe('insert vs insert', () => {
    it('should transform concurrent inserts at same position', () => {
      const op1 = new TextOperation().insert('A');
      const op2 = new TextOperation().insert('B');

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const text = '';
      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });

    it('should transform inserts at different positions', () => {
      const text = 'Hello';
      const op1 = new TextOperation().retain(2).insert('X');  // HeXllo
      const op2 = new TextOperation().retain(4).insert('Y');  // HellYo

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });
  });

  describe('insert vs delete', () => {
    it('should transform insert before delete', () => {
      const text = 'Hello';
      const op1 = new TextOperation().retain(2).insert('X');  // HeXllo
      const op2 = new TextOperation().retain(3).delete(2);    // Hel

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });

    it('should transform insert after delete', () => {
      const text = 'Hello';
      const op1 = new TextOperation().retain(4).insert('X');  // HellXo
      const op2 = new TextOperation().retain(1).delete(2);    // Hlo

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });
  });

  describe('delete vs delete', () => {
    it('should transform overlapping deletes', () => {
      const text = 'ABCDE';
      const op1 = new TextOperation().retain(1).delete(2);  // ADE
      const op2 = new TextOperation().retain(2).delete(2);  // ABE

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });

    it('should transform same delete', () => {
      const text = 'ABC';
      const op1 = new TextOperation().retain(1).delete(1);  // AC
      const op2 = new TextOperation().retain(1).delete(1);  // AC

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });

    it('should transform non-overlapping deletes', () => {
      const text = 'ABCDEF';
      const op1 = new TextOperation().delete(2);             // CDEF
      const op2 = new TextOperation().retain(4).delete(2);   // ABCD

      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));

      expect(result1).toBe(result2);
    });
  });

  describe('convergence property', () => {
    it('should always converge for random operations', () => {
      // Test various scenarios
      const scenarios = [
        { text: 'Hello', op1: new TextOperation().insert('A'), op2: new TextOperation().insert('B') },
        { text: 'Hello', op1: new TextOperation().retain(5).insert('!'), op2: new TextOperation().insert('Hi ') },
        { text: 'ABCDEF', op1: new TextOperation().delete(3), op2: new TextOperation().retain(3).delete(3) },
        { text: 'Test', op1: new TextOperation().retain(2).insert('X').delete(1), op2: new TextOperation().delete(2).insert('YY') },
      ];

      for (const { text, op1, op2 } of scenarios) {
        const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
        const result1 = op2Prime.apply(op1.apply(text));
        const result2 = op1Prime.apply(op2.apply(text));
        expect(result1).toBe(result2);
      }
    });
  });
});

describe('calculateTextOperation()', () => {
  it('should calculate operation for insertion', () => {
    const oldText = 'Hello';
    const newText = 'Hello World';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should calculate operation for deletion', () => {
    const oldText = 'Hello World';
    const newText = 'Hello';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should calculate operation for replacement', () => {
    const oldText = 'Hello World';
    const newText = 'Hello Universe';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should calculate operation for insertion in middle', () => {
    const oldText = 'Hello World';
    const newText = 'Hello Beautiful World';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should calculate operation for deletion in middle', () => {
    const oldText = 'Hello Beautiful World';
    const newText = 'Hello World';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should handle identical text', () => {
    const text = 'Hello World';
    const op = calculateTextOperation(text, text);
    expect(op.apply(text)).toBe(text);
  });

  it('should handle empty to non-empty', () => {
    const oldText = '';
    const newText = 'Hello';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should handle non-empty to empty', () => {
    const oldText = 'Hello';
    const newText = '';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should handle single character changes', () => {
    const oldText = 'cat';
    const newText = 'bat';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should handle multiline text', () => {
    const oldText = 'line1\nline2';
    const newText = 'line1\nnewline\nline2';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });

  it('should handle unicode characters', () => {
    const oldText = 'Hello 世界';
    const newText = 'Hello 世界!';
    const op = calculateTextOperation(oldText, newText);
    expect(op.apply(oldText)).toBe(newText);
  });
});

describe('TextOperation - transform() edge cases', () => {
  it('should transform when one operation is empty (identity)', () => {
    const text = 'Hello';
    const op1 = new TextOperation().retain(5);
    const op2 = new TextOperation().insert('X');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(text));
    const result2 = op1Prime.apply(op2.apply(text));
    expect(result1).toBe(result2);
  });

  it('should transform two insert-only operations (no retains)', () => {
    const text = '';
    const op1 = new TextOperation().insert('ABC');
    const op2 = new TextOperation().insert('XYZ');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(text));
    const result2 = op1Prime.apply(op2.apply(text));
    expect(result1).toBe(result2);
  });

  it('should transform large operations with many characters', () => {
    const text = 'A'.repeat(1000);
    const op1 = new TextOperation().retain(500).insert('MIDDLE');
    const op2 = new TextOperation().retain(999).insert('END');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(text));
    const result2 = op1Prime.apply(op2.apply(text));
    expect(result1).toBe(result2);
    expect(result1).toContain('MIDDLE');
    expect(result1).toContain('END');
  });

  it('should transform insert at position where other op deletes', () => {
    const text = 'ABCDE';
    // Op1 inserts at position 2
    const op1 = new TextOperation().retain(2).insert('X');
    // Op2 deletes characters 1-3 (BCD)
    const op2 = new TextOperation().retain(1).delete(3);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(text));
    const result2 = op1Prime.apply(op2.apply(text));
    expect(result1).toBe(result2);
  });

  it('should transform delete of entire document vs insert at start', () => {
    const text = 'ABC';
    const op1 = new TextOperation().delete(3);
    const op2 = new TextOperation().insert('Z');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(text));
    const result2 = op1Prime.apply(op2.apply(text));
    expect(result1).toBe(result2);
  });

  it('should transform multiline inserts concurrently', () => {
    const text = 'line1\nline2';
    const op1 = new TextOperation().retain(5).insert('\ninserted');
    const op2 = new TextOperation().retain(11).insert('\nline3');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(text));
    const result2 = op1Prime.apply(op2.apply(text));
    expect(result1).toBe(result2);
    expect(result1).toContain('inserted');
    expect(result1).toContain('line3');
  });

  describe('TP1 convergence property', () => {
    // TP1: apply(apply(doc, op1), transform(op2, op1)) = apply(apply(doc, op2), transform(op1, op2))
    function verifyTP1(text: string, op1: TextOperation, op2: TextOperation) {
      const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
      const result1 = op2Prime.apply(op1.apply(text));
      const result2 = op1Prime.apply(op2.apply(text));
      expect(result1).toBe(result2);
      return result1;
    }

    it('should satisfy TP1 for concurrent inserts at same position', () => {
      verifyTP1('ABCDE',
        new TextOperation().retain(3).insert('X'),
        new TextOperation().retain(3).insert('Y')
      );
    });

    it('should satisfy TP1 for insert vs delete at same position', () => {
      verifyTP1('ABCDE',
        new TextOperation().retain(2).insert('XY'),
        new TextOperation().retain(2).delete(2)
      );
    });

    it('should satisfy TP1 for replace vs replace (different regions)', () => {
      verifyTP1('ABCDEFGH',
        new TextOperation().delete(2).insert('XX'),
        new TextOperation().retain(6).delete(2).insert('YY')
      );
    });

    it('should satisfy TP1 for delete entire text vs insert', () => {
      verifyTP1('ABCDE',
        new TextOperation().delete(5),
        new TextOperation().retain(2).insert('Z')
      );
    });

    it('should satisfy TP1 for multiple inserts vs single delete', () => {
      verifyTP1('ABCDE',
        new TextOperation().insert('1').retain(2).insert('2').retain(3),
        new TextOperation().retain(1).delete(3)
      );
    });

    it('should satisfy TP1 for unicode content', () => {
      verifyTP1('Hello 世界',
        new TextOperation().retain(6).insert('美丽的'),
        new TextOperation().retain(8).insert('!')
      );
    });

    it('should satisfy TP1 for single-character document', () => {
      verifyTP1('A',
        new TextOperation().delete(1).insert('B'),
        new TextOperation().delete(1).insert('C')
      );
    });
  });
});

describe('TextOperation - operation composition via sequential apply', () => {
  it('should compose two sequential inserts correctly', () => {
    const text = 'Hello';
    const op1 = new TextOperation().retain(5).insert(' World');
    const op2 = new TextOperation().retain(11).insert('!');

    const intermediate = op1.apply(text);
    const result = op2.apply(intermediate);
    expect(result).toBe('Hello World!');
  });

  it('should compose insert then delete', () => {
    const text = 'Hello World';
    const op1 = new TextOperation().retain(5).insert(' Beautiful');

    const intermediate = op1.apply(text);
    expect(intermediate).toBe('Hello Beautiful World');

    // Delete " World" (last 6 chars) from the intermediate result
    const op2 = new TextOperation().retain(15).delete(6);
    const result = op2.apply(intermediate);
    expect(result).toBe('Hello Beautiful');
  });

  it('should compose delete then insert at same position', () => {
    const text = 'ABCDE';
    const op1 = new TextOperation().retain(2).delete(1); // Remove 'C' -> "ABDE"
    const op2 = new TextOperation().retain(2).insert('X'); // Insert 'X' at position 2 -> "ABXDE"

    const intermediate = op1.apply(text);
    expect(intermediate).toBe('ABDE');
    const result = op2.apply(intermediate);
    expect(result).toBe('ABXDE');
  });

  it('should compose multiple operations to build a code snippet', () => {
    let text = '';

    // Type function declaration
    const op1 = calculateTextOperation(text, 'function');
    text = op1.apply(text);
    expect(text).toBe('function');

    // Add parentheses and braces
    const op2 = calculateTextOperation(text, 'function() {}');
    text = op2.apply(text);
    expect(text).toBe('function() {}');

    // Add function name
    const op3 = calculateTextOperation(text, 'function hello() {}');
    text = op3.apply(text);
    expect(text).toBe('function hello() {}');

    // Add body
    const op4 = calculateTextOperation(text, 'function hello() { return true; }');
    text = op4.apply(text);
    expect(text).toBe('function hello() { return true; }');
  });

  it('should compose operations that undo each other', () => {
    const original = 'Hello World';

    const op1 = calculateTextOperation(original, 'Hello');
    const afterDelete = op1.apply(original);
    expect(afterDelete).toBe('Hello');

    const op2 = calculateTextOperation(afterDelete, 'Hello World');
    const restored = op2.apply(afterDelete);
    expect(restored).toBe(original);
  });

  it('should compose operations with calculateTextOperation for a realistic editing session', () => {
    let text = '// TODO: implement';

    // User replaces comment with code
    const op1 = calculateTextOperation(text, 'const x = 5;');
    text = op1.apply(text);

    // User adds a second line
    const op2 = calculateTextOperation(text, 'const x = 5;\nconst y = 10;');
    text = op2.apply(text);

    // User adds a third line
    const op3 = calculateTextOperation(text, 'const x = 5;\nconst y = 10;\nreturn x + y;');
    text = op3.apply(text);

    expect(text).toBe('const x = 5;\nconst y = 10;\nreturn x + y;');
  });
});

describe('Real-world collaborative editing scenarios', () => {
  it('should handle two users typing at different positions', () => {
    const originalText = 'function test() {}';

    // User 1: adds "async " at beginning
    const op1 = calculateTextOperation(originalText, 'async function test() {}');

    // User 2: adds "return;" inside braces
    const op2 = calculateTextOperation(originalText, 'function test() {return;}');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(originalText));
    const result2 = op1Prime.apply(op2.apply(originalText));

    expect(result1).toBe(result2);
    expect(result1).toContain('async');
    expect(result1).toContain('return;');
  });

  it('should handle two users deleting different parts', () => {
    const originalText = 'Hello Beautiful World!';

    // User 1: removes "Beautiful "
    const op1 = calculateTextOperation(originalText, 'Hello World!');

    // User 2: removes "!"
    const op2 = calculateTextOperation(originalText, 'Hello Beautiful World');

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const result1 = op2Prime.apply(op1.apply(originalText));
    const result2 = op1Prime.apply(op2.apply(originalText));

    expect(result1).toBe(result2);
    expect(result1).toBe('Hello World');
  });

  it('should handle rapid sequential typing', () => {
    let text = '';

    const operations = [
      calculateTextOperation(text, 'H'),
      calculateTextOperation('H', 'He'),
      calculateTextOperation('He', 'Hel'),
      calculateTextOperation('Hel', 'Hell'),
      calculateTextOperation('Hell', 'Hello'),
    ];

    for (const op of operations) {
      text = op.apply(text);
    }

    expect(text).toBe('Hello');
  });

  it('should handle code indentation changes', () => {
    const originalText = 'if (true) {\nreturn;\n}';
    const newText = 'if (true) {\n  return;\n}';

    const op = calculateTextOperation(originalText, newText);
    expect(op.apply(originalText)).toBe(newText);
  });
});
