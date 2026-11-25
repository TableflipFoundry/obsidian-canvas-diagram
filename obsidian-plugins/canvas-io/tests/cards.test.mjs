import test from 'node:test';import assert from 'node:assert/strict';
import {isIOCard,cardAnchor} from '../src/cards.ts';
test('ordinary cards remain standard; Markdown notes default to I/O',()=>{
  assert.equal(isIOCard({type:'text'}),false);assert.equal(isIOCard({type:'file',file:'image.png'}),false);
  assert.equal(isIOCard({type:'file',file:'nodes/routes.md'}),true);
  assert.equal(isIOCard({type:'text',canvasIO:{ports:true}}),true);
  assert.equal(isIOCard({type:'file',file:'routes.md',canvasIO:{ports:false}}),false);
});
test('legacy legends stay ordinary without migration; existing hand-drawn I/O cards survive',()=>{
  assert.equal(isIOCard({type:'text',id:'legend-component'},true),false);
  assert.equal(isIOCard({type:'group',canvasIO:{ports:true}}),false);
  assert.equal(isIOCard({type:'text'},true),true);
  assert.equal(isIOCard({type:'text',canvasIO:{ports:false}},true),false);
});
test('a mixed connection uses each card mode without changing port roles',()=>{
  const box={minX:0,minY:0,maxX:320,maxY:200};
  assert.deepEqual(cardAnchor(box,'right','output',false),{x:320,y:100});
  assert.deepEqual(cardAnchor(box,'right','output',true),{x:330,y:76});
});
