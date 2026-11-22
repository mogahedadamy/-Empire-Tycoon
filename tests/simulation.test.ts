import {describe,it,expect} from 'vitest';
import {applyCommand,initialWorld} from '../src/simulation';
describe('headless simulation',()=>{
 it('rejects invalid plots and duplicate buildings',()=>{const w=initialWorld();expect(applyCommand(w,{type:'build',kind:'farm',x:-1,y:0})).toBe(w);const a=applyCommand(w,{type:'build',kind:'farm',x:1,y:1});expect(applyCommand(a,{type:'build',kind:'farm',x:1,y:1})).toBe(a)});
 it('applies costs and advances production deterministically',()=>{const a=applyCommand(initialWorld(),{type:'build',kind:'farm',x:1,y:1});expect(a.gold).toBe(170);expect(a.wood).toBe(85);expect(applyCommand(a,{type:'advance',ticks:5}).gold).toBe(175);expect(applyCommand(a,{type:'advance',ticks:5})).toEqual(applyCommand(a,{type:'advance',ticks:5}))});
});
