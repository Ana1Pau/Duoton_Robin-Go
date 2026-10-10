import test from 'node:test';
import assert from 'node:assert/strict';
import {expenseRecord,expenseTotals,expenseCSV} from '../dist/expenses-domain.mjs';
const base={scope:'company',title:'Internet',merchant:'Proveedor',category:'Otros',date:'2026-10-10',amount:'12.29',currency:'MXN'};
test('stores exact cents and keeps edits on the same record',()=>{const first=expenseRecord(base);const edited=expenseRecord({...base,amount:'0.01'},first);assert.equal(first.amountMinor,1229);assert.equal(edited.amountMinor,1);assert.equal(edited.id,first.id);assert.equal(edited.paymentVerified,false);});
test('rejects invalid financial inputs',()=>{for(const patch of [{amount:'0'},{amount:'12.299'},{amount:'-3'},{currency:'XXX'},{scope:'other'},{date:'2026-02-30'}])assert.throws(()=>expenseRecord({...base,...patch}));});
test('does not mix currencies',()=>{assert.deepEqual(expenseTotals([expenseRecord(base),expenseRecord({...base,currency:'USD',amount:'5'})]),{MXN:1229,USD:500});});
test('CSV escapes quotes and spreadsheet formulas',()=>{const csv=expenseCSV([expenseRecord({...base,title:'=SUM(A1)',merchant:'A "B"'})]);assert.ok(csv.includes('"\'=SUM(A1)"'));assert.ok(csv.includes('"A ""B"""'));});
