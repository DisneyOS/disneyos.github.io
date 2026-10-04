import test from 'node:test';import assert from 'node:assert/strict';
import {candidateCard,watchAcquisitionText} from '../v1/js/lightning-lanes.mjs';
test('read-only improvement opportunity displays comparison without a change authorization action',()=>{
  const html=candidateCard({status:'READY_FOR_CONFIRMATION',notificationOnly:true,expiresAt:new Date(Date.now()+300000).toISOString(),current:{startMinute:945,endMinute:1005},proposed:{experienceName:'Fabricated attraction',startMinute:715,endMinute:775}});
  assert.match(html,/230 minutes earlier/);assert.match(html,/Review this option in Disney/);assert.match(html,/not reserved/);assert.doesNotMatch(html,/data-confirm|Authorize change/);
});
test('new-selection opportunity handles no existing booking',()=>{
  assert.doesNotThrow(()=>candidateCard({status:'READY_FOR_CONFIRMATION',notificationOnly:true,expiresAt:new Date(Date.now()+300000).toISOString(),current:null,proposed:{experienceName:'Fabricated',startMinute:715,endMinute:775}}));
});
test('dynamic eligibility and authorization messaging preserves exact party intent',()=>{
  assert.match(watchAcquisitionText({inventoryStatus:{state:'WAITING_FOR_ELIGIBILITY'}}),/Everyone remains in the party/);
  assert.match(watchAcquisitionText({inventoryStatus:{state:'AUTHORIZATION_BLOCKED'}}),/party remains unchanged/);
});
test('representative nonmatch messaging requests detail without claiming exhaustive absence',()=>{
  assert.match(watchAcquisitionText({inventoryStatus:{state:'NEEDS_DETAIL'}}),/does not settle/);
  assert.match(watchAcquisitionText({inventoryStatus:{state:'INCONCLUSIVE'}}),/incomplete/);
});
