/* DealerDoc Filler v2 — application logic (ES module). */
import { num, has, money, round2, computeContract, isCalcId,
         monthlyPayment, loanTotals, isValidVIN, dealDerived } from './calc.js';
import { parseLicenseText } from './ocr.js';

/* ================= constants ================= */
const USERS = {
  admin:   { pw: 'admin123',   role: 'admin',   label: 'Administrator' },
  sales:   { pw: 'sales123',   role: 'sales',   label: 'Sales' },
  finance: { pw: 'finance123', role: 'finance', label: 'Finance' },
};
/* field helper: F(id,x,y,w, opts, extra) ; opts: s=small a=amt c=checkbox g=sig q=required
 * Tolerates the options object being passed in the opts position (common slip),
 * so f.o is always a string and f.o.includes() never throws. */
const F = (id,x,y,w,o='',extra={}) => {
  if (o && typeof o === 'object'){ extra = o; o = ''; }
  return {id,x,y,w,o,...extra};
};

const TEMPLATES = [
{ id:'cos1', name:'Contract of Sale — page 1', img:'assets/loan-pg-1.jpg', orient:'portrait',
  note:'Form 104-2 (IDS Rev. 06/19). Coordinates reused from calibrated v1.',
  req:['purchaserName','streetAddress','city','state','zip','year','make','vin','dateOfSale','line1'],
  fields:[
    F('sellerDealer',2,2.4,34,'q'),
    F('dateOfSale',82,3.1,16,'q'),
    F('purchaserName',62,6.2,36,'q'), F('streetAddress',62,8.7,36,'q'),
    F('city',62,11.7,12,'q'), F('county',76,11.7,9,'s'), F('state',86,11.7,5,'sq'), F('zip',93,11.7,5,'sq'),
    F('resPhone',62,14.7,18), F('busPhone',82,14.7,16),
    F('cond',4,19.6,0,'r',{val:'NEW'}), F('cond',9,19.6,0,'r',{val:'USED'}), F('cond',14,19.6,0,'r',{val:'DEMO'}),
    F('year',17,19.3,9,'q'), F('make',27,19.3,23,'q'), F('series',51,19.3,23,'s'),
    F('bodyType',75,19.3,10,'s'), F('cyl',86,19.3,5,'s'), F('color',92,19.3,7,'s'),
    F('vin',2,22.2,46,'sq'), F('odometer',52,22.2,13,'s'),
    F('stockNo',68,22.2,11,'s'), F('delDate',81,22.2,9,'s'), F('salesperson',91,22.2,8,'s'),
    F('line1',42,27.2,16,'aq'), F('line2',42,28.5,16,'a'), F('line3',42,29.7,16,'a'),
    F('line4',42,30.9,16,'a'), F('line5',42,32.1,16,'a'),
    F('line6',42,33.5,16,'a', {calc:'line6'}), F('line7',42,34.9,16,'a'), F('line8',42,36.3,16,'a'),
    F('line9',42,37.7,16,'a', {calc:'line9'}),
    F('titleChk',57,28.0,0,'c'),
    F('docReg',57.5,31.2,0,'c'), F('docPOA',64,31.2,0,'c'), F('docOdo',70.5,31.2,0,'c'),
    F('docAppr',76.5,31.2,0,'c'), F('docPayoff',82.5,31.2,0,'c'), F('docOutCntry',89.5,31.2,0,'c'),
    F('ftcX',56.5,36.3,0,'c'),
    F('tradeYearMake',2,40.6,28,'s'), F('tradeOdometer',32,40.6,26,'s'),
    F('tradeSeries',2,42.6,26,'s'), F('tradeBodyType',30,42.6,28,'s'),
    F('tradeVin',2,44.6,56,'s'), F('balanceOwedTo',15,48.0,43,'s'),
    F('payoffVerifiedBy',2,51.6,26,'s'), F('goodUntil',30,51.6,28,'s'),
    F('dateOfVerification',2,54.1,26,'s'), F('accNo',30,54.1,28,'s'),
    F('line10',42,60.2,16,'a'), F('line11',42,61.4,16,'a'),
    F('line12',42,62.7,16,'a',{calc:'line12'}), F('line13',42,63.9,16,'a'),
    F('line14',42,65.2,16,'a',{calc:'line14'}), F('line15',42,66.7,16,'a',{calc:'line15'}),
    F('line16',42,67.9,16,'a'), F('line17',42,69.2,16,'a'), F('line18',42,70.4,16,'a'),
    F('line19',42,71.7,16,'a',{calc:'line19'}), F('line20',42,73.2,16,'a',{calc:'line20'}),
    F('line21',42,74.7,16,'a',{calc:'line21'}), F('line22',42,76.7,16,'a',{calc:'line22'}),
    F('line23',42,77.9,16,'a'), F('line24',42,79.2,16,'a'),
    F('line25',42,80.4,16,'a'), F('line26',42,81.7,16,'a'),
    F('sigDisclosureA',58,48.4,37,'g',{sigKey:'sig_purchaser'}),
    F('intRateFrom',71.5,67.6,6,'s'), F('intRateTo',81.5,67.6,6,'s'),
    F('termFrom',69.5,68.9,6,'s'), F('termTo',81.5,68.9,6,'s'),
    F('payFrom',63.5,70.2,14,'s'), F('payTo',86,70.2,11,'s'),
    F('finDown',68,71.5,30,'s',{auto:'line14'}),
    F('sigDisclosureB',58,96.3,37,'g',{sigKey:'sig_purchaser'}),
    F('sigSellerB',58,98.0,37,'g',{sigKey:'sig_seller'}),
  ]},
{ id:'cos2', name:'Contract of Sale — page 2', img:'assets/loan-pg-2.jpg', orient:'portrait',
  note:'Form 104-2 continued: lines 10–31, other terms, insurance, signatures.',
  req:['line1','line29','line31'],
  fields:[
    F('line1',42,1.4,16,'aq'), F('line2',42,2.7,16,'a'), F('line3',42,3.9,16,'a'),
    F('line4',42,5.1,16,'a'), F('line5',42,6.3,16,'a'),
    F('line6',42,7.6,16,'a',{calc:'line6'}), F('line7',42,8.8,16,'a'), F('line8',42,10.0,16,'a'),
    F('line9',42,11.3,16,'a',{calc:'line9'}),
    F('docReg',58,4.2,0,'c'), F('docPOA',64,4.2,0,'c'), F('docOdo',70,4.2,0,'c'),
    F('docAppr',76,4.2,0,'c'), F('docPayoff',82,4.2,0,'c'), F('docOutCntry',89,4.2,0,'c'),
    F('ftcX',56.5,10.6,0,'c'),
    F('tradeYearMake',2,16.2,28,'s'), F('tradeOdometer',32,16.2,24,'s'),
    F('tradeSeries',2,19.7,26,'s'), F('tradeBodyType',30,19.7,26,'s'),
    F('tradeVin',2,23.2,56,'s'), F('balanceOwedTo',15,26.7,43,'s'), F('tradeAddress',2,28.7,56,'s'),
    F('payoffVerifiedBy',2,32.7,24,'s'), F('goodUntil',30,32.7,26,'s'),
    F('dateOfVerification',2,35.7,24,'s'), F('accNo',30,35.7,26,'s'),
    F('line10',42,39.8,16,'a'), F('line11',42,41.1,16,'a'),
    F('line12',42,42.4,16,'a',{calc:'line12'}), F('line13',42,43.7,16,'a'),
    F('line14',42,45.0,16,'a',{calc:'line14'}), F('line15',42,46.3,16,'a',{calc:'line15'}),
    F('line16',42,47.6,16,'a'), F('line17',42,48.9,16,'a'), F('line18',42,50.2,16,'a'),
    F('line19',42,51.5,16,'a',{calc:'line19'}), F('line20',42,52.8,16,'a',{calc:'line20'}),
    F('line21',42,54.1,16,'a',{calc:'line21'}), F('line22',42,56.8,16,'a',{calc:'line22'}),
    F('line23',42,58.1,16,'a'), F('line24',42,59.4,16,'a'),
    F('line25',42,60.7,16,'a'), F('line26',42,62.0,16,'a'),
    F('line27',42,63.3,16,'a'), F('line28',42,64.6,16,'a'),
    F('line29',42,65.9,16,'a',{calc:'line29'}), F('line30',42,67.2,16,'a',{calc:'line30'}),
    F('line31',42,68.5,16,'a',{calc:'line31'}),
    F('dealDay',4,69.8,8), F('dealMonth',14,69.8,10), F('dealYear',26,69.8,8),
    F('insuranceCo',38,71.8,30,'s'), F('policyNo',74,71.8,24,'s'),
    F('otherTermsNone',76.5,78.2,0,'c'), F('otherTermsFollows',88.5,78.2,0,'c'),
    F('sigCosPurchaser',2,92.3,36,'g',{sigKey:'sig_purchaser'}),
    F('sigDate',40,92.3,12), F('titledIn',56,92.3,42),
    F('sigCosCoPurchaser',2,95.3,36,'g',{sigKey:'sig_copurchaser'}),
    F('sigDate2',40,95.3,12,{auto:'sigDate'}),
    F('sigCosSeller',56,95.3,32,'g',{sigKey:'sig_seller'}),
    F('sigDate3',88,95.3,10,{auto:'sigDate'}),
  ]},
{ id:'fin', name:'Finance Agreement', img:'assets/fin-agreement.jpg', orient:'portrait',
  note:'Investment Strategies finance agreement. Monthly payment via standard amortization.',
  req:['finRate','finMonths'],
  fields:[
    F('finTopAmount',18,4.7,20,'a',{calc:'finPrincipal'}),
    F('finBuyerName',11,6.6,60,'q',{auto:'purchaserName'}),
    F('finYear',4,11.8,13,{auto:'year'}), F('finMake',18,11.8,17,{auto:'make'}),
    F('finModel',36,11.8,17,{auto:'series'}), F('finMileage',54,11.8,17,{auto:'odometer'}),
    F('finVin',72,11.8,25,'s',{auto:'vin'}),
    F('finPurchasePrice',14,14.8,22,'a',{auto:'line6'}),
    F('finDownPay',46,14.8,16,'a',{auto:'line14'}),
    F('finOther',70,14.8,28),
    F('finRatePct',14,16.8,16,'q',{auto:'finRate',suffix:'%'}),
    F('finChargeAmt',52,16.8,22,'a',{calc:'finCharge'}),
    F('finTotalAmt',24,18.8,30,'a',{calc:'finTotal'}),
    F('finMonthlyBox',78,18.3,18,'a',{calc:'finMonthly'}),
    F('payStartMonth',30,20.8,12), F('payStartDay',45,20.8,8), F('payStartYear',56,20.8,10),
    F('finTermMonths',26,22.3,10,{auto:'finMonths'}),
    F('signDay',22,66.8,20), F('signMonthName',48,66.8,20), F('signYear2',74,66.8,6),
    F('sigFinLender',10,68.6,36,'g',{sigKey:'sig_lender'}),
    F('sigFinBuyer1',10,70.8,32,'g',{sigKey:'sig_buyer'}),
    F('sigFinBuyer2',47,70.8,38,'g',{sigKey:'sig_buyer'}),
    F('finSSN1',18,73.5,30,{auto:'ssn'}), F('finSSN2',52,73.5,40),
    F('finDL1',20,75.8,28,{auto:'dlNo'}), F('finDL2',52,75.8,40),
    F('finAddress',12,78.3,45,{auto:'streetAddress'}),
    F('finCity',7,80.8,30,{auto:'city'}), F('finState',44,80.8,25,{auto:'state'}),
    F('finZip',76,80.8,20,{auto:'zip'}),
    F('finInitials',10,94.8,12), F('finInitAmount',28,94.8,20,'a'),
  ]},
{ id:'cw', name:'Credit Warranty', img:'assets/credit-warranty.jpg', orient:'portrait',
  note:'Investment Strategies credit warranty — signature and date only.',
  req:[], fields:[
    F('sigCW',10,82.3,50,'g',{sigKey:'sig_buyer'}),
    F('cwDate',65,82.3,25,{auto:'dateOfSale'}),
  ]},
{ id:'ledger', name:'Payment Ledger', img:'assets/payment-ledger.jpg', orient:'portrait',
  note:'Payment ledger header only; rows stay blank for hand entry.',
  req:[], fields:[
    F('ledgerName',2,5.8,25,{auto:'purchaserName'}),
    F('ledgerAddr',30,5.8,35,{auto:'streetAddress'}),
    F('ledgerMonthly',72,5.8,25,'a',{calc:'finMonthly'}),
    F('ledgerTaxLic',75,94.3,22,'a',{calc:'ledgerTaxLic'}),
  ]},
{ id:'til', name:'Truth in Lending Disclosure', img:'assets/til.jpg', orient:'portrait',
  note:'TIL disclosure — computed via standard amortization.',
  req:['tilApr','tilMonths'],
  fields:[
    F('tilName',24,8.3,72,'q',{auto:'purchaserName'}),
    F('tilAddr',24,10.3,72,{auto:'fullAddr'}),
    F('tilPhone',24,12.3,30,{auto:'resPhone'}),
    F('tilVehicle',26,14.6,30,{auto:'vehDesc'}),
    F('tilVin',78,14.6,20,'s',{auto:'vin'}),
    F('tilAprBox',4,23.5,22,'q',{calc:'tilApr',suffix:'%'}),
    F('tilAmtBox',28,23.5,22,'a',{calc:'tilAmount'}),
    F('tilChargeBox',52,23.5,22,'a',{calc:'tilCharge'}),
    F('tilTotalBox',76,23.5,22,'a',{calc:'tilTotal'}),
    F('tilNumPay',3,31.0,22,{calc:'tilMonths'}),
    F('tilDueDayText',28,31.0,22,'s',{auto:'tilDueDayText'}),
    F('tilMonthlyBox',56,31.0,40,'a',{calc:'tilMonthly'}),
    F('sigTilApplicant',5,76.0,40,'g',{sigKey:'sig_buyer'}),
    F('tilDate1',52,76.8,20,{auto:'dateOfSale'}),
    F('sigTilLender',5,79.5,40,'g',{sigKey:'sig_lender'}),
    F('tilDate2',52,80.3,20,{auto:'dateOfSale'}),
  ]},
{ id:'odo', name:'Odometer Disclosure (TC-891)', img:'assets/odometer-tc891.jpg', orient:'portrait',
  note:'Utah TC-891 Rev. 6/26. Transferor = dealer/seller; transferee = purchaser.',
  req:['odoReading','odoTransferor','odoTransferee'],
  fields:[
    F('odoTransferor',5,9.0,90,'q',{auto:'dealerName'}),
    F('odoTAddr',5,11.3,52), F('odoTCity',58,11.3,18), F('odoTState',77,11.3,6), F('odoTZip',84,11.3,12),
    F('odoYear',5,15.3,20,{auto:'year'}), F('odoMake',26,15.3,28,{auto:'make'}),
    F('odoModel',62,15.3,33,{auto:'series'}),
    F('odoVin',5,17.6,60,'s',{auto:'vin'}), F('odoBody',66,17.6,29,{auto:'bodyType'}),
    F('odoReading',27,24.3,12,'q',{auto:'odometer'}),
    F('odoUnit',39,25.6,0,'r',{val:'miles'}), F('odoUnit',48,25.6,0,'r',{val:'km'}),
    F('odoCert',10,29.0,0,'r',{val:'actual'}), F('odoCert',10,30.6,0,'r',{val:'excess'}), F('odoCert',10,32.2,0,'r',{val:'notactual'}),
    F('sigOdoTransferor',5,34.3,70,'g',{sigKey:'sig_seller'}),
    F('odoDate1',80,34.3,15,{auto:'dateOfSale'}),
    F('odoTransferee',5,40.3,90,'q',{auto:'purchaserName'}),
    F('odoTeAddr',5,42.8,52,{auto:'streetAddress'}), F('odoTeCity',58,42.8,18,{auto:'city'}),
    F('odoTeState',77,42.8,6,{auto:'state'}), F('odoTeZip',84,42.8,12,{auto:'zip'}),
    F('sigOdoTransferee',5,44.8,70,'g',{sigKey:'sig_buyer'}),
    F('odoDate2',80,44.8,15,{auto:'dateOfSale'}),
  ]},
{ id:'jacket', name:'Deal Jacket', img:'assets/jacket.jpg', orient:'landscape',
  note:'IDS deal jacket (landscape). Key deal fields + 24-item document checklist.',
  req:['stockNo'],
  fields:[
    F('jStock',2,2.0,30,'q',{auto:'stockNo'}), F('jDatePurch',2,4.5,30,{auto:'dateOfSale'}),
    F('jMake',2,7.0,18,{auto:'make'}), F('jYear',22,7.0,10,{auto:'year'}),
    F('jModel',2,9.5,18,{auto:'series'}), F('jType',22,9.5,10,{auto:'bodyType'}),
    F('jVin',2,12.0,30,'s',{auto:'vin'}),
    F('jSerial',2,14.5,18), F('jCyl',22,14.5,10,{auto:'cyl'}),
    F('jOdo',2,17.0,16,{auto:'odometer'}), F('jColor',20,17.0,12,{auto:'color'}),
    F('jLicense',2,19.5,16), F('jKey',20,19.5,12),
    F('jTab',2,22.0,16), F('jExp',20,22.0,12),
    /* 24-item checklist — checkboxes */
    F('jk0',2.5,26.5,0,'c'), F('jk1',2.5,28.5,0,'c'), F('jk2',2.5,30.5,0,'c'),
    F('jk3',2.5,32.5,0,'c'), F('jk4',2.5,34.8,0,'c'), F('jk5',2.5,37.4,0,'c'),
    F('jk6',2.5,39.4,0,'c'), F('jk7',2.5,41.4,0,'c'), F('jk8',2.5,43.4,0,'c'),
    F('jk9',2.5,45.4,0,'c'), F('jk10',2.5,47.4,0,'c'), F('jk11',2.5,49.4,0,'c'),
    F('jk12',20,26.5,0,'c'), F('jk13',20,28.5,0,'c'), F('jk14',20,30.5,0,'c'),
    F('jk15',20,32.5,0,'c'), F('jk16',20,34.8,0,'c'), F('jk17',20,37.4,0,'c'),
    F('jk18',20,39.4,0,'c'), F('jk19',20,41.4,0,'c'), F('jk20',20,43.4,0,'c'),
    F('jk21',20,45.4,0,'c'), F('jk22',20,47.4,0,'c'), F('jk23',2.5,53.5,0,'c'),
    F('jPurchFrom',34,2.0,28), F('jPurchAddr',34,7.5,28),
    F('jPurchCity',34,10.0,12), F('jPurchState',47,10.0,6), F('jPurchZip',54,10.0,8),
    F('jPurchPhone',34,12.5,28),
    F('jCostEquity',52,15.0,10,'a'), F('jPayoff',52,17.5,10,'a'), F('jCommission',52,20.0,10,'a'),
    F('jTotalDirect',52,22.5,10,'a',{calc:'jTotalDirect'}),
    F('jSoldTo',66,3.0,32,{auto:'purchaserName'}), F('jSoldDate',88,1.0,10,'s',{auto:'dateOfSale'}),
    F('jSoldAddr',66,5.5,22,{auto:'streetAddress'}), F('jSoldPhone',90,5.5,8,'s',{auto:'resPhone'}),
    F('jSoldCity',66,8.0,16,{auto:'city'}), F('jSoldState',83,8.0,6,{auto:'state'}),
    F('jSoldZip',90,8.0,8,{auto:'zip'}),
    F('jRSNo',66,10.5,16),
    F('cond',93.5,10.8,0,'r',{val:'NEW'}), F('cond',96.3,10.8,0,'r',{val:'USED'}),
    F('jSalePrice',93,13.0,6,'a',{auto:'line9'}),
    F('jAccessories',93,15.5,6,'a',{auto:'line2'}),
    F('jDocFee',93,18.0,6,'a',{auto:'line17'}),
    F('jTaxPct',70,20.5,8,{auto:'taxRate',suffix:'%'}),
    F('jTaxOn',80,20.5,13,'a',{auto:'line21'}),
    F('jSalesTax',93,20.5,6,'a',{auto:'line22'}),
    F('jSvcContract',93,25.5,6,'a',{auto:'line16'}),
    F('jAmtOthers',93,28.0,6,'a',{auto:'line18'}),
    F('jTotalCash',93,31.0,6,'a',{calc:'line29'}),
    F('jAmtDOL',80,32.8,13,'a'),
    F('jLicense',93,35.0,6,'a'), F('jCertTitle',93,37.5,6,'a'), F('jRegist',93,40.0,6,'a'),
    F('jTotalOfficial',93,42.5,6,'a'), F('jInsCo',93,45.0,6,'a'), F('jSmog',93,47.5,6,'a'),
    F('jJacketTotal',93,50.0,6,'a'),
    F('jTradeIn',78,53.0,8,'a',{auto:'line10'}), F('jTradeIn2',88,53.0,5,'a',{auto:'line10'}),
    F('jLessPayoff',78,55.5,8,'a',{auto:'line11'}), F('jLessPayoff2',88,55.5,5,'a',{auto:'line11'}),
    F('jNetAllow',78,58.0,8,'a',{auto:'line12'}), F('jNetAllow2',88,58.0,5,'a',{auto:'line12'}),
    F('jDefDown',78,60.5,8,'a',{auto:'line13'}), F('jDefDown2',88,60.5,5,'a',{auto:'line13'}),
    F('jMfgRebate',78,63.0,8,'a',{auto:'line7'}), F('jMfgRebate2',88,63.0,5,'a',{auto:'line7'}),
    F('jRemCash',78,65.5,8,'a'), F('jRemCash2',88,65.5,5,'a',{auto:'jRemCash'}),
    F('jTotalDown',93,69.5,6,'a',{calc:'jacketTotalDown'}),
    F('jAmtFin',93,72.0,6,'a',{calc:'finPrincipal'}),
    F('jApr',93,74.5,6,{auto:'finRate',suffix:'%'}),
    F('jFinCharge',93,77.0,6,'a',{calc:'finCharge'}),
    F('jTotalSale',93,79.5,6,'a',{calc:'finTotal'}),
    F('jPayableAmt',70,82.5,8,'a'), F('jPayableOn',82,82.5,6), F('jPayableYr',95,82.5,4),
    F('jMonthlyInst',76,85.0,8,'a',{calc:'finMonthly'}), F('jBeginOn',90,85.0,8),
  ]},
];

/* 24 jacket checklist labels (order matches jk0..jk23 overlay positions) */
const JACKET_CHECKLIST = [
  'Certificate of Title','Duplicate Title App.','Secure Power of Attorney','Odometer Statement',
  'Motor Vehicle Contract of Sale','Privacy Notice','Dealer Application for Title','Non-Resident Affidavit',
  'Authorization for Payoff','Consignment Agreement','Wholesale Only','Auction Ticket',
  'FTC Buyers Guide','Good Will Agreement','As Is Implied Warranty','Delivery Confirmation',
  'Manufactured for Use Out of Country','Installment Sales & Security Agreement','Down Payment Disclosure',
  'Customer Delivery Checklist','Insurance Agreement','Notice to Co-signer','Credit Insurance Notice',
  'Security Agreement or Contract — Sold/Discounted',
];

const SIG_SLOTS = [
  { key:'sig_purchaser', label:'Purchaser' },
  { key:'sig_copurchaser', label:'Co-purchaser' },
  { key:'sig_seller', label:'Seller / Dealer' },
  { key:'sig_lender', label:'Lender' },
  { key:'sig_buyer', label:'Buyer (finance docs)' },
];

/* ================= store ================= */
const LS_KEY = 'dd_v2';
function loadStore(){
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.deals) return s; } catch(e){}
  return { customers:[], vehicles:[], deals:[], audit:[], calib:{}, seq:1 };
}
let store = loadStore();
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(store)); }
function uid(p){ return p + (store.seq++) + '_' + Date.now().toString(36); }

/* ================= utils ================= */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const todayISO = () => new Date().toISOString().slice(0,10);
function audit(action, detail){
  store.audit.unshift({ ts:new Date().toISOString(), user:session?.user||'?', action, detail:String(detail||'').slice(0,200) });
  if (store.audit.length > 500) store.audit.length = 500;
  save();
}

/* ================= auth ================= */
let session = JSON.parse(sessionStorage.getItem('dd_v2_session') || 'null');
const role = () => session?.role || null;
const canDelete = () => role() === 'admin';

/* ================= value resolution ================= */
function calcResolve(key, d, der){
  if (key in der.contract) return der.contract[key];
  switch(key){
    case 'finPrincipal': return der.fin.principal;
    case 'finMonthly': return der.fin.monthly;
    case 'finCharge': return der.fin.financeCharge;
    case 'finTotal': return der.fin.totalOfPayments;
    case 'tilAmount': return der.til.amount;
    case 'tilApr': return has(der.til.apr) ? num(der.til.apr) : null;
    case 'tilMonths': return has(der.til.months) ? num(der.til.months) : null;
    case 'tilCharge': return der.til.financeCharge;
    case 'tilTotal': return der.til.totalOfPayments;
    case 'tilMonthly': return der.til.monthly;
    case 'ledgerTaxLic': {
      let t=0,any=false;
      for (const k of ['line22','line23','line24','line25','line26']){ const v=der.contract[k]; if(v!=null){any=true;t+=v;} }
      return any?round2(t):null;
    }
    case 'jTotalDirect': {
      const a=has(d.jCostEquity)?num(d.jCostEquity):0, b=has(d.jPayoff)?num(d.jPayoff):0, c=has(d.jCommission)?num(d.jCommission):0;
      return (has(d.jCostEquity)||has(d.jPayoff)||has(d.jCommission))?round2(a+b+c):null;
    }
    case 'jacketTotalDown': {
      const l12=der.contract.line12??0, l13=der.contract.line13??0, l7=der.contract.line7??0;
      const rc=has(d.jRemCash)?num(d.jRemCash):0;
      const any = der.contract.line12!=null||der.contract.line13!=null||der.contract.line7!=null||has(d.jRemCash);
      return any?round2(l12+l13+l7+rc):null;
    }
    case 'fullAddr': {
      const parts=[d.streetAddress, [d.city,d.state,d.zip].filter(Boolean).join(', ')];
      return parts.filter(Boolean).join(' · ') || null;
    }
    case 'vehDesc': return [d.year,d.make,d.series].filter(Boolean).join(' ') || null;
    case 'tilDueDayText': return has(d.tilDueDay) ? `Monthly on the ${d.tilDueDay} day of the month` : null;
    default: return has(d[key]) ? d[key] : null; // plain data-key auto
  }
}
/* resolve one overlay field -> {v (display string or null), auto, raw} */
function resolveField(deal, f){
  const d = deal.data, der = dealDerived(d);
  if (f.o.includes('g')){
    const img = deal.signatures[f.sigKey || f.id];
    return img ? { v:'IMG:'+img, auto:false } : { v:null, auto:false };
  }
  if (f.o.includes('c')) return { v: d[f.id] ? '✕' : null, auto:false };
  if (f.o.includes('r')) return { v: (d[f.id] === f.val) ? '✕' : null, auto:false };
  if (f.calc){
    const raw = calcResolve(f.calc, d, der);
    if (raw === null || raw === undefined || raw === '') return { v:null, auto:true, raw:null };
    let v = (f.o.includes('a')) ? money(raw) : String(raw);
    if (f.suffix) v += f.suffix;
    return { v, auto:true, raw };
  }
  let v = d[f.id], auto = false;
  if ((v === undefined || v === null || String(v).trim() === '') && f.auto){
    const r = calcResolve(f.auto, d, der);
    if (r !== null && r !== undefined && String(r).trim() !== ''){ v = r; auto = true; }
  }
  if (v === undefined || v === null || String(v).trim() === '') return { v:null, auto };
  let out = (f.o.includes('a')) ? money(v) : String(v);
  if (f.suffix && auto) out += f.suffix;
  return { v: out, auto };
}
function missingFields(deal, tpl){
  return tpl.fields.filter(f => f.o.includes('q')).filter(f => {
    const r = resolveField(deal, f);
    return r.v === null;
  });
}

/* ================= deal form schema ================= */
/* t: text|num|date|sel|radio|check ; calc:readonly computed ; auto:placeholder source key */
const FORM = [
 ['Deal', [
   {id:'dateOfSale',label:'Date of sale',t:'date'},{id:'salesperson',label:'Salesperson'},
   {id:'dealerName',label:'Seller / Dealer name'},{id:'stockNo',label:'Stock no.'},
   {id:'delDate',label:'Delivery date',t:'date'},{id:'titledIn',label:'Titled in name of'},
   {id:'status',label:'Status',t:'sel',opts:['open','ready','printed','closed']},
 ]],
 ['Financing disclosure (A / B)', [
   {id:'discChoice',label:'Disclosure',t:'radio',opts:['A','B']},
   {id:'intRateFrom',label:'Rate between %',t:'num'},{id:'intRateTo',label:'and %',t:'num'},
   {id:'termFrom',label:'Term between (mo)',t:'num'},{id:'termTo',label:'and (mo)',t:'num'},
   {id:'payFrom',label:'Payments between $',t:'num'},{id:'payTo',label:'and $ / mo',t:'num'},
   {id:'finDown',label:'On a down payment of $',t:'num',auto:'line14'},
 ]],
 ['Purchase price — lines 1–9', [
   {id:'line1',label:'1 · Cash price of vehicle',t:'num'},{id:'line2',label:'2 · Accessories/options',t:'num'},
   {id:'line3',label:'3 ·',t:'num'},{id:'line4',label:'4 ·',t:'num'},{id:'line5',label:'5 ·',t:'num'},
   {id:'line6',label:'6 · Total cash price (1–5)',t:'num',calc:'line6'},
   {id:'line7',label:'7 · Mfr. rebate',t:'num'},{id:'line8',label:'8 · Rebate applied',t:'num'},
   {id:'line9',label:'9 · Subtotal (6−7−8)',t:'num',calc:'line9'},
   {id:'taxRate',label:'Utah sales/use tax rate %',t:'num'},
 ]],
 ['Trade-in', [
   {id:'tradeYearMake',label:'Trade year / make'},{id:'tradeOdometer',label:'Trade odometer'},
   {id:'tradeSeries',label:'Trade series'},{id:'tradeBodyType',label:'Trade body type'},
   {id:'tradeVin',label:'Trade VIN'},{id:'tradeAddress',label:'Trade address'},
   {id:'balanceOwedTo',label:'Balance owed to'},{id:'payoffVerifiedBy',label:'Payoff verified by'},
   {id:'goodUntil',label:'Good until'},{id:'dateOfVerification',label:'Date of verification'},
   {id:'accNo',label:'Acct #'},
 ]],
 ['Credits, taxes & fees — lines 10–28', [
   {id:'line10',label:'10 · Trade-in allowance',t:'num'},{id:'line11',label:'11 · Balance owed on trade',t:'num'},
   {id:'line12',label:'12 · Net allowance (10−11)',t:'num',calc:'line12'},
   {id:'line13',label:'13 · Deposit / cash down',t:'num'},
   {id:'line14',label:'14 · Total credits (12+13)',t:'num',calc:'line14'},
   {id:'line15',label:'15 · Subtotal from line 9',t:'num',calc:'line15'},
   {id:'line16',label:'16 · Service contract',t:'num'},{id:'line17',label:'17 · Doc fee',t:'num'},
   {id:'line18',label:'18 · Other',t:'num'},
   {id:'line19',label:'19 · Subtotal taxable (15–18)',t:'num',calc:'line19'},
   {id:'line20',label:'20 · Trade allowance (→10)',t:'num',calc:'line20'},
   {id:'line21',label:'21 · Net taxable (19−20)',t:'num',calc:'line21'},
   {id:'line22',label:'22 · UT sales/use tax',t:'num',calc:'line22'},
   {id:'line23',label:'23 · License / registration',t:'num'},{id:'line24',label:'24 · Age-based fees',t:'num'},
   {id:'line25',label:'25 · Inspection / emissions',t:'num'},{id:'line26',label:'26 · Tire fee',t:'num'},
   {id:'line27',label:'27 ·',t:'num'},{id:'line28',label:'28 ·',t:'num'},
   {id:'line29',label:'29 · Total (19,22–28)',t:'num',calc:'line29'},
   {id:'line30',label:'30 · Total credits (→14)',t:'num',calc:'line30'},
   {id:'line31',label:'31 · BALANCE DUE (29−30)',t:'num',calc:'line31'},
 ]],
 ['Finance agreement', [
   {id:'finAmount',label:'Amount financed $',t:'num',auto:'line31'},
   {id:'finRate',label:'Interest rate % (APR)',t:'num'},{id:'finMonths',label:'Term (months)',t:'num'},
   {id:'finOther',label:'Other'},{id:'payStartMonth',label:'First payment — month'},
   {id:'payStartDay',label:'day'},{id:'payStartYear',label:'year'},
   {id:'insuranceCo',label:'Insurance company'},{id:'policyNo',label:'Policy #'},
   {id:'finInitials',label:'Initials'},{id:'finInitAmount',label:'Initials amount $',t:'num'},
   {id:'_finMonthly',label:'Monthly payment (calc)',t:'num',calc:'finMonthly'},
   {id:'_finCharge',label:'Finance charge (calc)',t:'num',calc:'finCharge'},
   {id:'_finTotal',label:'Total of payments (calc)',t:'num',calc:'finTotal'},
 ]],
 ['Truth in lending', [
   {id:'tilAmount',label:'Amount financed $',t:'num',auto:'finPrincipal'},
   {id:'tilApr',label:'APR %',t:'num',auto:'finRate'},
   {id:'tilMonths',label:'Number of payments',t:'num',auto:'finMonths'},
   {id:'tilDueDay',label:'Payments due on day of month',t:'num'},
 ]],
 ['Odometer disclosure (TC-891)', [
   {id:'odoReading',label:'Odometer reading',t:'num',auto:'odometer'},
   {id:'odoUnit',label:'Reading is',t:'radio',opts:['miles','km']},
   {id:'odoCert',label:'Certify',t:'radio',opts:['actual','excess','notactual']},
   {id:'odoTAddr',label:'Transferor street'},{id:'odoTCity',label:'city'},
   {id:'odoTState',label:'state'},{id:'odoTZip',label:'zip'},
 ]],
 ['Deal jacket — extras', [
   {id:'jSerial',label:'Serial no.'},{id:'jLicense',label:'License no.'},
   {id:'jTab',label:'Tab no.'},{id:'jExp',label:'Exp.'},{id:'jKey',label:'Key no.'},
   {id:'jPurchFrom',label:'Purchased from'},{id:'jPurchAddr',label:'address'},
   {id:'jPurchCity',label:'city'},{id:'jPurchState',label:'state'},{id:'jPurchZip',label:'zip'},
   {id:'jPurchPhone',label:'telephone'},{id:'jCostEquity',label:'Cost or equity $',t:'num'},
   {id:'jPayoff',label:'Pay off $',t:'num'},{id:'jCommission',label:'Commission $',t:'num'},
   {id:'jRSNo',label:'R/S no.'},{id:'jAmtDOL',label:'Amount paid to DOL $',t:'num'},
   {id:'jLicense',label:'License $',t:'num'},{id:'jCertTitle',label:'Cert. of title $',t:'num'},
   {id:'jRegist',label:'Registration $',t:'num'},{id:'jTotalOfficial',label:'Total official fees $',t:'num'},
   {id:'jInsCo',label:'Amt paid to insurance co. $',t:'num'},{id:'jSmog',label:'Smog fee $',t:'num'},
   {id:'jJacketTotal',label:'TOTAL $',t:'num'},{id:'jRemCash',label:'Remaining cash $',t:'num'},
   {id:'jPayableAmt',label:'Payable $',t:'num'},{id:'jPayableOn',label:'on'},
   {id:'jPayableYr',label:'20'},{id:'jBeginOn',label:'Each beginning on'},
 ]],
];
const CUST_FIELDS = [
  {id:'name',label:'Full name',req:1},{id:'dob',label:'Date of birth'},{id:'streetAddress',label:'Street address'},{id:'city',label:'City'},
  {id:'county',label:'County'},{id:'state',label:'State'},{id:'zip',label:'ZIP'},
  {id:'resPhone',label:'Res. phone'},{id:'busPhone',label:'Bus. phone'},{id:'email',label:'Email'},
  {id:'ssn',label:'SSN'},{id:'dlNo',label:"Driver's license #"},
];
const VEH_FIELDS = [
  {id:'vin',label:'VIN (17 chars)'},{id:'year',label:'Year'},{id:'make',label:'Make'},
  {id:'model',label:'Model'},{id:'trim',label:'Trim'},{id:'bodyType',label:'Body type'},
  {id:'engine',label:'Engine'},{id:'cyl',label:'Cyl'},{id:'color',label:'Color'},
  {id:'mileage',label:'Mileage'},{id:'stockNo',label:'Stock no.'},
  {id:'condition',label:'Condition',t:'sel',opts:['','NEW','USED','DEMO']},
];

/* ================= overlay renderer ================= */
function calibFor(tplId, fid){
  return (store.calib[tplId] && store.calib[tplId][fid]) || null;
}
function renderPage(deal, tpl, opts={}){
  const page = document.createElement('div');
  page.className = 'doc-page ' + tpl.orient + (opts.sel ? ' sel' : '') + (opts.screenHide ? ' screen-hide' : '');
  page.style.backgroundImage = `url("${tpl.img}")`;
  page.dataset.tpl = tpl.id;
  const showMissing = opts.showMissing !== false;
  for (const f of tpl.fields){
    const r = resolveField(deal, f);
    const cal = calibFor(tpl.id, f.id);
    const x = f.x + (cal?cal.dx:0), y = f.y + (cal?cal.dy:0);
    if (r.v === null){
      if (showMissing && f.o.includes('q') && !opts.calib){
        const m = document.createElement('div');
        m.className = 'fld miss' + (f.o.includes('s')?' small':'');
        m.style.left = x+'%'; m.style.top = y+'%'; m.style.width = (f.w||6)+'%';
        m.title = 'Missing required: ' + f.id;
        page.appendChild(m);
      }
      continue;
    }
    const d = document.createElement('div');
    if (String(r.v).startsWith('IMG:')){
      d.className = 'fld sig';
      d.style.left=x+'%'; d.style.top=y+'%'; d.style.width=f.w+'%'; d.style.height='3%';
      const img = document.createElement('img'); img.src = r.v.slice(4); img.alt='signature';
      d.appendChild(img);
    } else {
      d.className = 'fld' + (f.o.includes('a')?' amt':'') + (f.o.includes('s')?' small':'')
        + (f.o.includes('c')||f.o.includes('r')?' chk':'');
      d.textContent = r.v;
      d.style.left=x+'%'; d.style.top=y+'%';
      if (f.w) d.style.width = f.w+'%';
      if (r.auto) d.title = 'Auto-filled';
    }
    if (opts.calib){
      d.classList.add('calib'); d.dataset.fid = f.id;
      d.title = f.id + ' — drag to nudge';
    }
    page.appendChild(d);
  }
  if (opts.calib) enableCalibDrag(page, tpl);
  return page;
}
function enableCalibDrag(page, tpl){
  let drag = null;
  page.addEventListener('pointerdown', e => {
    const t = e.target.closest('.fld.calib'); if (!t) return;
    drag = { el:t, fid:t.dataset.fid, sx:e.clientX, sy:e.clientY };
    const r0 = page.getBoundingClientRect();
    drag.rect = r0; drag.el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  page.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / drag.rect.width * 100;
    const dy = (e.clientY - drag.sy) / drag.rect.height * 100;
    const base = tpl.fields.find(f=>f.id===drag.fid);
    const cur = calibFor(tpl.id, drag.fid) || {dx:0,dy:0};
    drag.el.style.left = (base.x + cur.dx + dx) + '%';
    drag.el.style.top = (base.y + cur.dy + dy) + '%';
    drag.ddx = dx; drag.ddy = dy;
  });
  page.addEventListener('pointerup', () => {
    if (!drag) return;
    const cur = calibFor(tpl.id, drag.fid) || {dx:0,dy:0};
    const ndx = Math.round((cur.dx + (drag.ddx||0))*100)/100;
    const ndy = Math.round((cur.dy + (drag.ddy||0))*100)/100;
    store.calib[tpl.id] = store.calib[tpl.id] || {};
    store.calib[tpl.id][drag.fid] = {dx:ndx, dy:ndy};
    save(); audit('calibrate', `${tpl.id}.${drag.fid} → ${ndx},${ndy}`);
    drag = null;
  });
}

/* ================= tabs / router ================= */
const TABS = [
  ['dashboard','Dashboard'],['customers','Customers'],['vehicles','Vehicles'],
  ['deals','Deals'],['documents','Documents'],
];
let curTab = 'dashboard';
let curCustomerId=null, curVehicleId=null, curDealId=null, dealSub='form';
let docDealId=null, docTplId='cos1', docCalib=false, dealQuery='', dealStatusF='';

function renderTabs(){
  const el = document.getElementById('mainTabs'); el.innerHTML='';
  const tabs = role()==='admin' ? [...TABS,['audit','Audit'],['about','About']] : [...TABS,['about','About']];
  for (const [id,label] of tabs){
    const b = document.createElement('button');
    b.textContent = label; b.className = curTab===id?'active':'';
    b.onclick = () => showView(id);
    el.appendChild(b);
  }
}
function showView(id){
  curTab = id; renderTabs();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const fn = {dashboard:vDashboard,customers:vCustomers,vehicles:vVehicles,deals:vDeals,
              documents:vDocuments,audit:vAudit,about:vAbout}[id];
  if (fn) fn();
  document.getElementById('view-'+id).classList.add('active');
  window.scrollTo(0,0);
}
function dealName(d){
  const c = store.customers.find(x=>x.id===d.customerId);
  const v = store.vehicles.find(x=>x.id===d.vehicleId);
  return [c?.name, v ? `${v.year||''} ${v.make||''} ${v.model||''}`.trim() : '', d.data.stockNo]
    .filter(Boolean).join(' · ') || 'Untitled deal';
}
function custName(id){ return store.customers.find(x=>x.id===id)?.name || '—'; }
function vehName(id){ const v=store.vehicles.find(x=>x.id===id); return v?`${v.year||''} ${v.make||''} ${v.model||''} ${v.vin||''}`.trim():'—'; }

/* ================= dashboard ================= */
function vDashboard(){
  const el = document.getElementById('view-dashboard');
  const open = store.deals.filter(d=>d.data.status==='open'||!d.data.status).length;
  const prints = store.audit.filter(a=>a.action==='print').length;
  el.innerHTML = `
  <div class="grid3 no-print" style="margin-bottom:16px">
    <div class="stat"><div class="n">${store.customers.length}</div><div class="l">Customers</div></div>
    <div class="stat"><div class="n">${store.vehicles.length}</div><div class="l">Vehicles</div></div>
    <div class="stat"><div class="n">${store.deals.length}</div><div class="l">Deals (${open} open)</div></div>
  </div>
  <div class="panel no-print"><h2>Deals</h2>
    <div class="toolbar">
      <input id="dq" placeholder="Search customer, VIN, stock…" value="${esc(dealQuery)}" style="flex:1;min-width:200px">
      <select id="dsf"><option value="">All statuses</option>${['open','ready','printed','closed'].map(s=>`<option ${dealStatusF===s?'selected':''}>${s}</option>`).join('')}</select>
      <button class="btn sm" id="newDealBtn">+ New deal</button>
    </div>
    <div style="overflow-x:auto"><table class="list"><thead><tr>
      <th>Deal</th><th>Status</th><th>Balance due</th><th>Missing fields</th><th></th>
    </tr></thead><tbody id="dealRows"></tbody></table></div>
  </div>
  <div class="panel no-print"><h2>Recent activity</h2><ul class="audit" style="padding-left:18px;margin:0">
    ${store.audit.slice(0,8).map(a=>`<li>${esc(a.ts.slice(0,16).replace('T',' '))} — <b>${esc(a.user)}</b> ${esc(a.action)}: ${esc(a.detail)}</li>`).join('')||'<li>No activity yet.</li>'}
  </ul></div>`;
  const draw = () => {
    const q = dealQuery.toLowerCase();
    const rows = store.deals.filter(d=>{
      if (dealStatusF && (d.data.status||'open')!==dealStatusF) return false;
      if (!q) return true;
      return (dealName(d)+' '+(d.data.vin||'')).toLowerCase().includes(q);
    });
    document.getElementById('dealRows').innerHTML = rows.map(d=>{
      const der = dealDerived(d.data);
      const miss = TEMPLATES.reduce((n,t)=>n+missingFields(d,t).length,0);
      const st = d.data.status||'open';
      return `<tr><td><a href="#" data-deal="${d.id}">${esc(dealName(d))}</a></td>
        <td><span class="pill ${st}">${esc(st)}</span></td>
        <td>${der.contract.line31!=null?('$'+money(der.contract.line31)):'—'}</td>
        <td>${miss?`<span class="missing-tag">${miss} missing</span>`:'<span style="color:var(--pine)">✓</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn sm ghost" data-docs="${d.id}">Documents</button>
          ${canDelete()?`<button class="btn sm warn" data-deldeal="${d.id}">Delete</button>`:''}
        </td></tr>`;
    }).join('') || '<tr><td colspan="5" style="color:var(--mut)">No deals yet.</td></tr>';
    el.querySelectorAll('[data-deal]').forEach(a=>a.onclick=e=>{e.preventDefault();curDealId=a.dataset.deal;dealSub='form';showView('deals');});
    el.querySelectorAll('[data-docs]').forEach(b=>b.onclick=()=>{docDealId=b.dataset.docs;showView('documents');});
    el.querySelectorAll('[data-deldeal]').forEach(b=>b.onclick=()=>{
      if(!confirm('Delete this deal?'))return;
      store.deals=store.deals.filter(x=>x.id!==b.dataset.deldeal); save(); audit('delete deal',b.dataset.deldeal); draw();
    });
  };
  document.getElementById('dq').oninput = e=>{dealQuery=e.target.value;draw();};
  document.getElementById('dsf').onchange = e=>{dealStatusF=e.target.value;draw();};
  document.getElementById('newDealBtn').onclick = ()=>{curDealId=null;showView('deals');};
  draw();
}

/* ================= driver's license OCR =================
 * Auto-reads the customer's ID photo with Tesseract.js (client-side only —
 * the photo never leaves this device). Lazy-loads the engine from CDN on
 * first use, so the app still works offline until OCR is requested.
 * Parsed fields fill BLANK inputs only, never overwrite manually-verified
 * values, and every auto-filled field still requires manual confirmation
 * via the existing "verify from photo" flags. */
let tesseractLoading = null;
/* Last OCR run, for the "What the app read" debug view (not saved to storage). */
let lastOcr = null;
function loadTesseract(){
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoading) return tesseractLoading;
  tesseractLoading = new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = ()=> window.Tesseract ? resolve(window.Tesseract)
      : reject(new Error('OCR engine failed to initialize.'));
    s.onerror = ()=> reject(new Error('Could not download the OCR engine — check your internet connection and retry.'));
    document.head.appendChild(s);
  });
  return tesseractLoading;
}
/* Upscale + grayscale + autocontrast the photo before OCR.
 * Tesseract reads small/low-contrast phone photos much better this way.
 * Falls back to the original image if anything goes wrong. */
function preprocessForOCR(dataUrl){
  return new Promise((resolve)=>{
    try{
      const img = new Image();
      img.onload = ()=>{
        try{
          const scale = Math.min(2.5, 1800/Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width*scale));
          const h = Math.max(1, Math.round(img.height*scale));
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const idata = ctx.getImageData(0, 0, w, h), d = idata.data;
          const lum = new Uint8ClampedArray(w*h);
          let mn = 255, mx = 0;
          for (let i=0;i<w*h;i++){
            const l = 0.299*d[i*4] + 0.587*d[i*4+1] + 0.114*d[i*4+2];
            lum[i] = l; if (l<mn) mn = l; if (l>mx) mx = l;
          }
          const range = Math.max(1, mx-mn);
          for (let i=0;i<w*h;i++){
            const v = Math.round((lum[i]-mn)/range*255);
            d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255;
          }
          ctx.putImageData(idata, 0, 0);
          resolve(cv.toDataURL('image/jpeg', 0.92));
        }catch(e){ resolve(dataUrl); }
      };
      img.onerror = ()=>resolve(dataUrl);
      img.src = dataUrl;
    }catch(e){ resolve(dataUrl); }
  });
}
async function runLicenseOCR(c){
  const statusEl = ()=>document.getElementById('cf_ocr_status');
  const setStatus = t => { const el = statusEl(); if (el) el.textContent = t; };
  const btn = document.getElementById('cf_ocr');
  if (btn) btn.disabled = true;
  try{
    setStatus('Loading OCR engine…');
    const T = await loadTesseract();
    setStatus('Reading photo… 0%');
    const oem = (T.OEM && T.OEM.LSTM != null) ? T.OEM.LSTM : undefined;
    const worker = await T.createWorker('eng', oem, {
      logger: m => { if (m.status === 'recognizing text' && m.progress != null)
        setStatus('Reading photo… ' + Math.round(m.progress * 100) + '%'); }
    });
    let text = '';
    try{
      const ocrImg = await preprocessForOCR(c.idPhoto);
      const r = await worker.recognize(ocrImg);
      text = (r && r.data && r.data.text) || '';
    } finally {
      await worker.terminate();
    }
    const fields = parseLicenseText(text);
    const keys = Object.keys(fields);
    lastOcr = { cid: c.id, text, found: keys };
    if (!keys.length){
      setStatus('Could not read anything useful — photo may be blurry, angled, or cropped. Type the fields manually.');
      audit('OCR no result', c.name || '(new customer)');
      return;
    }
    // Preserve anything already typed; fill blanks only; never touch verified fields.
    for (const f of CUST_FIELDS){
      const inp = document.getElementById('cf_' + f.id);
      if (inp) c[f.id] = inp.value.trim();
    }
    const notesInp = document.getElementById('cf_notes');
    if (notesInp) c.notes = notesInp.value.trim();
    const filled = [];
    for (const k of keys){
      if (c.verify && c.verify[k]) continue;
      if (!c[k]){ c[k] = fields[k]; filled.push(k); }
    }
    save(); custForm(c);
    audit('OCR auto-fill', (c.name || '(new customer)') + ': ' + (filled.join(', ') || 'nothing new'));
    const st = statusEl();
    if (st) st.textContent = filled.length
      ? 'Auto-filled: ' + filled.join(', ') + ' — confirm each against the photo.'
      : 'Fields already have values — nothing new to fill. Confirm each against the photo.';
  }catch(err){
    setStatus('OCR failed: ' + (err && err.message ? err.message : err));
  }finally{
    const b = document.getElementById('cf_ocr');
    if (b) b.disabled = false;
  }
}

/* ================= customers ================= */
function vCustomers(){
  const el = document.getElementById('view-customers');
  el.innerHTML = `<div class="panel"><h2>Customers</h2>
    <div class="toolbar"><input id="cq" placeholder="Search customers…" style="flex:1;min-width:200px">
    <button class="btn sm" id="newCust">+ New customer</button></div>
    <div style="overflow-x:auto"><table class="list"><thead><tr><th>Name</th><th>Phone</th><th>City</th><th>ID photo</th><th></th></tr></thead>
    <tbody id="custRows"></tbody></table></div></div>
    <div id="custForm"></div>`;
  const draw = (q='') => {
    const rows = store.customers.filter(c=>(c.name+' '+(c.city||'')+' '+(c.resPhone||'')).toLowerCase().includes(q.toLowerCase()));
    document.getElementById('custRows').innerHTML = rows.map(c=>`<tr>
      <td><b>${esc(c.name)}</b>${dupName(c)?' <span class="missing-tag" title="Another customer has this name">dup?</span>':''}</td>
      <td>${esc(c.resPhone||'—')}</td><td>${esc(c.city||'—')}</td>
      <td>${c.idPhoto?'✓':'—'}</td>
      <td style="white-space:nowrap"><button class="btn sm ghost" data-edit="${c.id}">Edit</button>
      ${canDelete()?`<button class="btn sm warn" data-del="${c.id}">Delete</button>`:''}</td></tr>`).join('')
      || '<tr><td colspan="5" style="color:var(--mut)">No customers yet.</td></tr>';
    el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>custForm(b.dataset.edit));
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      if(!confirm('Delete customer?'))return;
      store.customers=store.customers.filter(x=>x.id!==b.dataset.del); save(); audit('delete customer',b.dataset.del); draw(document.getElementById('cq').value);
    });
  };
  document.getElementById('cq').oninput = e=>draw(e.target.value);
  document.getElementById('newCust').onclick = ()=>custForm(null);
  draw();
}
function dupName(c){
  const n = (c.name||'').trim().toLowerCase();
  return !!n && store.customers.some(x=>x.id!==c.id && (x.name||'').trim().toLowerCase()===n);
}
function custForm(idOrObj){
  // Accepts a customer id, or the customer object itself (for not-yet-saved
  // customers being edited, e.g. right after a photo upload or OCR run).
  const c = (idOrObj && typeof idOrObj === 'object') ? idOrObj
    : (idOrObj ? (store.customers.find(x=>x.id===idOrObj) || {id:idOrObj, verify:{}})
               : {id:uid('c'), verify:{}});
  const isNew = !store.customers.some(x=>x.id===c.id);
  const host = document.getElementById('custForm');
  host.innerHTML = `<div class="panel"><h2>${isNew?'New':'Edit'} customer</h2>
    ${dupName(c)?'<div class="notice"><b>Duplicate-name warning:</b> another customer already has this name. Verify you are not creating a duplicate.</div>':''}
    <div class="idwrap">
      <div><fieldset><legend>Details</legend><div class="row">
        ${CUST_FIELDS.map(f=>`<label class="f">${f.label}${f.req?' *':''}
          <input id="cf_${f.id}" value="${esc(c[f.id]||'')}">
          ${c.verify&&c.verify[f.id]?'<span class="verified-flag">✓ verified from photo</span>':(c.idPhoto?`<span class="verify-flag">verify from photo <button type="button" class="btn sm ghost" data-vf="${f.id}">✓ confirm</button></span>`:'')}
        </label>`).join('')}
        </div><label class="f">Notes<textarea id="cf_notes" rows="2">${esc(c.notes||'')}</textarea></label>
      </fieldset></div>
      <div><fieldset><legend>ID photo</legend>
        ${c.idPhoto?`<img class="idphoto" src="${c.idPhoto}" alt="ID photo">`:'<p style="color:var(--mut);font-size:13px">No photo yet. Upload a driver’s license photo; then confirm each field against it.</p>'}
        <p><input type="file" id="cf_photo" accept="image/*"></p>
        ${c.idPhoto?`<p><button type="button" class="btn sm" id="cf_ocr">📷 Auto-read from photo</button>
        <span id="cf_ocr_status" style="font-size:12px;color:var(--mut)"></span></p>`:''}
        ${lastOcr && lastOcr.cid===c.id ? `<details style="margin-top:6px;font-size:12px">
          <summary style="cursor:pointer;color:var(--mut)">What the app read from the photo (tap to expand)</summary>
          <pre style="white-space:pre-wrap;background:#f6f6f4;border:1px solid var(--line);border-radius:6px;padding:8px;max-height:180px;overflow:auto">${esc(lastOcr.text)||'(no text detected)'}</pre>
          <p style="color:var(--mut);margin:4px 0 0">Parsed into fields: ${lastOcr.found.length?esc(lastOcr.found.join(', ')):'nothing'}</p>
        </details>`:''}
        <p style="font-size:12px;color:var(--mut)">Photo is stored in this browser only. Auto-read runs entirely on this device (the OCR engine downloads once — needs internet). Every auto-filled field must still be confirmed manually against the photo.</p>
      </fieldset></div>
    </div>
    <div style="display:flex;gap:8px"><button class="btn" id="cf_save">Save customer</button>
    <button class="btn ghost" id="cf_cancel">Cancel</button></div></div>`;
  host.querySelectorAll('[data-vf]').forEach(b=>b.onclick=()=>{
    c.verify=c.verify||{}; c.verify[b.dataset.vf]=true; save(); custForm(c);
  });
  document.getElementById('cf_photo').onchange = e=>{
    const file = e.target.files[0]; if(!file) return;
    const img = new Image();
    img.onload = ()=>{
      const cv = document.createElement('canvas');
      const s = Math.min(1, 900/Math.max(img.width,img.height));
      cv.width=img.width*s; cv.height=img.height*s;
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      c.idPhoto = cv.toDataURL('image/jpeg',0.8);
      URL.revokeObjectURL(img.src); save(); custForm(c);
    };
    img.src = URL.createObjectURL(file);
  };
  const ocrBtn = document.getElementById('cf_ocr');
  if (ocrBtn) ocrBtn.onclick = ()=>runLicenseOCR(c);  document.getElementById('cf_cancel').onclick = ()=>{host.innerHTML='';};
  document.getElementById('cf_save').onclick = ()=>{
    for (const f of CUST_FIELDS) c[f.id]=document.getElementById('cf_'+f.id).value.trim();
    c.notes=document.getElementById('cf_notes').value.trim();
    if(!c.name){alert('Name is required.');return;}
    if(!store.customers.some(x=>x.id===c.id)) store.customers.push(c);
    save(); audit(isNew?'create customer':'update customer', c.name);
    host.innerHTML=''; vCustomers();
  };
}

/* ================= vehicles ================= */
function vVehicles(){
  const el = document.getElementById('view-vehicles');
  el.innerHTML = `<div class="panel"><h2>Vehicles</h2>
    <div class="toolbar"><input id="vq" placeholder="Search VIN, make, model…" style="flex:1;min-width:200px">
    <button class="btn sm" id="newVeh">+ New vehicle</button></div>
    <div style="overflow-x:auto"><table class="list"><thead><tr><th>Vehicle</th><th>VIN</th><th>Stock</th><th></th></tr></thead>
    <tbody id="vehRows"></tbody></table></div></div><div id="vehForm"></div>`;
  const draw = (q='') => {
    const rows = store.vehicles.filter(v=>((v.vin||'')+' '+(v.make||'')+' '+(v.model||'')+' '+(v.stockNo||'')).toLowerCase().includes(q.toLowerCase()));
    document.getElementById('vehRows').innerHTML = rows.map(v=>`<tr>
      <td><b>${esc([v.year,v.make,v.model,v.trim].filter(Boolean).join(' '))}</b></td>
      <td style="font-family:monospace">${esc(v.vin||'—')}</td><td>${esc(v.stockNo||'—')}</td>
      <td style="white-space:nowrap"><button class="btn sm ghost" data-edit="${v.id}">Edit</button>
      ${canDelete()?`<button class="btn sm warn" data-del="${v.id}">Delete</button>`:''}</td></tr>`).join('')
      || '<tr><td colspan="4" style="color:var(--mut)">No vehicles yet.</td></tr>';
    el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>vehForm(b.dataset.edit));
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      if(!confirm('Delete vehicle?'))return;
      store.vehicles=store.vehicles.filter(x=>x.id!==b.dataset.del); save(); audit('delete vehicle',b.dataset.del); draw(document.getElementById('vq').value);
    });
  };
  document.getElementById('vq').oninput = e=>draw(e.target.value);
  document.getElementById('newVeh').onclick = ()=>vehForm(null);
  draw();
}
function vehForm(id){
  const v = id ? store.vehicles.find(x=>x.id===id) : {id:uid('v')};
  const host = document.getElementById('vehForm');
  host.innerHTML = `<div class="panel"><h2>${id?'Edit':'New'} vehicle</h2>
    <fieldset><legend>VIN decode (NHTSA, free)</legend>
      <div class="row"><label class="f">VIN<input id="vf_vin" value="${esc(v.vin||'')}" maxlength="17" style="font-family:monospace"></label>
      <label class="f">&nbsp;<span><button class="btn sm" id="vf_decode" type="button">Decode VIN</button></span></label></div>
      <div id="vf_decmsg" style="font-size:13px"></div>
    </fieldset>
    <fieldset><legend>Vehicle</legend><div class="row">
      ${VEH_FIELDS.filter(f=>f.id!=='vin').map(f=> f.t==='sel'
        ? `<label class="f">${f.label}<select id="vf_${f.id}">${f.opts.map(o=>`<option ${v[f.id]===o?'selected':''}>${o}</option>`).join('')}</select></label>`
        : `<label class="f">${f.label}<input id="vf_${f.id}" value="${esc(v[f.id]||'')}"></label>`).join('')}
    </div><label class="f">Notes<textarea id="vf_notes" rows="2">${esc(v.notes||'')}</textarea></label></fieldset>
    <div style="display:flex;gap:8px"><button class="btn" id="vf_save">Save vehicle</button>
    <button class="btn ghost" id="vf_cancel">Cancel</button></div></div>`;
  document.getElementById('vf_decode').onclick = async ()=>{
    const vin = document.getElementById('vf_vin').value.trim().toUpperCase();
    const msg = document.getElementById('vf_decmsg');
    if(!isValidVIN(vin)){ msg.innerHTML='<span class="missing-tag">Invalid VIN — must be 17 characters (no I, O, Q).</span>'; return; }
    msg.textContent = 'Decoding…';
    try{
      const r = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/'+encodeURIComponent(vin)+'?format=json');
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json(); const R = j.Results[0];
      if(!R || R.ErrorCode!=='0') throw new Error('VIN not decoded: '+(R&&R.ErrorText));
      const map = {year:R.ModelYear, make:R.Make, model:R.Model, trim:R.Trim, bodyType:R.BodyClass,
                   engine:(R.DisplacementL?R.DisplacementL+'L ':'')+(R.EngineCylinders?R.EngineCylinders+' cyl':''), cyl:R.EngineCylinders};
      for (const [k,val] of Object.entries(map)) if(val && val!=='Not Applicable'){ v[k]=String(val).trim(); const inp=document.getElementById('vf_'+k); if(inp) inp.value=v[k]; }
      msg.innerHTML = `<span style="color:var(--pine)">✓ Decoded: ${esc(R.ModelYear)} ${esc(R.Make)} ${esc(R.Model)}${R.Trim&&R.Trim!=='Not Applicable'?' '+esc(R.Trim):''}. Review and correct before saving.</span>`;
      audit('vin decode', vin);
    }catch(err){ msg.innerHTML = `<span class="missing-tag">Decode failed: ${esc(err.message)}. You can still enter the vehicle manually.</span>`; }
  };
  document.getElementById('vf_cancel').onclick = ()=>{host.innerHTML='';};
  document.getElementById('vf_save').onclick = ()=>{
    v.vin = document.getElementById('vf_vin').value.trim().toUpperCase();
    if(v.vin && !isValidVIN(v.vin) && !confirm('VIN looks invalid. Save anyway?')) return;
    for (const f of VEH_FIELDS.filter(f=>f.id!=='vin')) v[f.id]=document.getElementById('vf_'+f.id).value.trim();
    v.notes=document.getElementById('vf_notes').value.trim();
    if(!store.vehicles.some(x=>x.id===v.id)) store.vehicles.push(v);
    save(); audit(id?'update vehicle':'create vehicle', v.vin||vehName(v.id));
    host.innerHTML=''; vVehicles();
  };
}

/* ================= deals ================= */
function vDeals(){
  const el = document.getElementById('view-deals');
  if(!curDealId){
    el.innerHTML = `<div class="panel"><h2>New deal</h2>
      <div class="row"><label class="f">Customer<select id="nd_c">${store.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f">Vehicle<select id="nd_v">${store.vehicles.map(v=>`<option value="${v.id}">${esc(vehName(v.id))}</option>`).join('')}</select></label></div>
      ${store.customers.length===0||store.vehicles.length===0?'<div class="notice">Add at least one customer and one vehicle first.</div>':''}
      <button class="btn" id="nd_go" ${store.customers.length===0||store.vehicles.length===0?'disabled':''}>Create deal</button></div>`;
    document.getElementById('nd_go').onclick = ()=>{
      const cid=document.getElementById('nd_c').value, vid=document.getElementById('nd_v').value;
      const c=store.customers.find(x=>x.id===cid), v=store.vehicles.find(x=>x.id===vid);
      const d={id:uid('d'), customerId:cid, vehicleId:vid, data:{}, signatures:{}, checklist:{}, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
      const cmap={purchaserName:'name',streetAddress:'streetAddress',city:'city',county:'county',state:'state',zip:'zip',resPhone:'resPhone',busPhone:'busPhone',ssn:'ssn',dlNo:'dlNo'};
      for(const [dk,ck] of Object.entries(cmap)) if(c[ck]) d.data[dk]=c[ck];
      const vmap={year:'year',make:'make',series:'model',bodyType:'bodyType',cyl:'cyl',color:'color',vin:'vin',odometer:'mileage',stockNo:'stockNo',cond:'condition'};
      for(const [dk,vk] of Object.entries(vmap)) if(v[vk]) d.data[dk]=v[vk];
      d.data.dateOfSale=todayISO(); d.data.status='open';
      if(store.settings?.dealerName) d.data.dealerName=store.settings.dealerName;
      store.deals.push(d); save(); audit('create deal', dealName(d));
      curDealId=d.id; dealSub='form'; vDeals();
    };
    return;
  }
  const d = store.deals.find(x=>x.id===curDealId);
  if(!d){ curDealId=null; vDeals(); return; }
  const der = dealDerived(d.data);
  el.innerHTML = `<div class="panel"><h2>Deal — ${esc(dealName(d))}</h2>
    <div class="toolbar">
      <button class="btn sm ${dealSub==='form'?'':'ghost'}" data-ds="form">Deal data</button>
      <button class="btn sm ${dealSub==='check'?'':'ghost'}" data-ds="check">Checklist</button>
      <button class="btn sm ${dealSub==='sigs'?'':'ghost'}" data-ds="sigs">Signatures</button>
      <span class="pill ${(d.data.status||'open')}">${esc(d.data.status||'open')}</span>
      <span style="flex:1"></span>
      <button class="btn sm" id="dealDocs">Open documents →</button>
      <button class="btn sm ghost" id="dealBack">← All deals</button>
    </div>
    <div id="dealBody"></div></div>`;
  el.querySelectorAll('[data-ds]').forEach(b=>b.onclick=()=>{dealSub=b.dataset.ds;vDeals();});
  document.getElementById('dealBack').onclick=()=>{curDealId=null;showView('dashboard');};
  document.getElementById('dealDocs').onclick=()=>{docDealId=d.id;showView('documents');};
  const body = document.getElementById('dealBody');
  if(dealSub==='form') renderDealForm(d, body);
  else if(dealSub==='check') renderChecklist(d, body);
  else renderSigs(d, body);
}
function fieldInput(d, f){
  const val = d.data[f.id] ?? '';
  const der = dealDerived(d.data);
  let ph='', ro=false, cls='';
  if(f.calc){ ro=true; cls='calc'; const rv=calcResolve(f.calc,d.data,der); return `<input id="df_${f.id}" class="${cls}" readonly tabindex="-1" value="${rv==null?'':(typeof rv==='number'?money(rv):esc(rv))}">`; }
  if(f.auto){ const av=calcResolve(f.auto,d.data,der); if(av!=null&&av!=='') ph='auto: '+(typeof av==='number'?money(av):av); }
  if(f.t==='sel') return `<select id="df_${f.id}">${f.opts.map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
  if(f.t==='radio') return `<span class="radio-row" style="display:flex;gap:14px">${f.opts.map(o=>`<label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="radio" name="df_${f.id}" value="${o}" ${val===o?'checked':''} style="width:auto"> ${o}</label>`).join('')}</span>`;
  if(f.t==='date') return `<input id="df_${f.id}" type="date" value="${esc(val)}" placeholder="${esc(ph)}">`;
  if(f.t==='num') return `<input id="df_${f.id}" inputmode="decimal" value="${esc(val)}" placeholder="${esc(ph)}">`;
  return `<input id="df_${f.id}" value="${esc(val)}" placeholder="${esc(ph)}">`;
}
function renderDealForm(d, body){
  body.innerHTML = FORM.map(([title,fields],si)=>`<fieldset><legend>${title}</legend>
    ${fields.map((f,i)=>`${i%2===0?'<div class="row">':''}<label class="f">${f.label}${f.calc?' <span class="tag">calculated</span>':''}${f.auto?' <span class="tag" style="color:var(--blue)">auto</span>':''}${fieldInput(d,f)}</label>${i%2===1||i===fields.length-1?'</div>':''}`).join('')}
  </fieldset>`).join('') + `<div style="display:flex;gap:8px;align-items:center">
    <span style="font-size:12.5px;color:var(--mut)">Autosave on — calculated fields update live.</span></div>`;
  const refresh = ()=>{
    d.updatedAt=new Date().toISOString(); save();
    const der = dealDerived(d.data);
    for(const [title,fields] of FORM) for(const f of fields){
      if(!f.calc) continue;
      const inp=document.getElementById('df_'+f.id); if(!inp) continue;
      const rv=calcResolve(f.calc,d.data,der);
      inp.value = rv==null?'':(typeof rv==='number'?money(rv):rv);
    }
    for(const [title,fields] of FORM) for(const f of fields){
      if(f.calc||!f.auto) continue;
      const inp=document.getElementById('df_'+f.id);
      if(inp && !inp.value){ const av=calcResolve(f.auto,d.data,dealDerived(d.data)); inp.placeholder = (av==null||av==='')?'':'auto: '+(typeof av==='number'?money(av):av); }
    }
  };
  for(const [title,fields] of FORM) for(const f of fields){
    if(f.calc) continue;
    if(f.t==='radio'){
      body.querySelectorAll(`input[name="df_${f.id}"]`).forEach(r=>r.addEventListener('change',()=>{
        d.data[f.id]=r.value; audit('edit deal', dealName(d)+' · '+f.id+'='+r.value); refresh();
      }));
    } else {
      const inp=document.getElementById('df_'+f.id);
      if(inp) inp.addEventListener('input',()=>{ d.data[f.id]=inp.value; refresh(); });
    }
  }
}
function renderChecklist(d, body){
  let done = JACKET_CHECKLIST.filter((_,i)=>d.checklist[i]).length;
  body.innerHTML = `<p style="font-size:13px;color:var(--mut)">24-item document checklist from the deal jacket — also marks the jacket checkboxes on the printed form.</p>
    <div class="progress"><div id="ckBar" style="width:${done/24*100}%"></div></div>
    <div id="ckList">${JACKET_CHECKLIST.map((n,i)=>`<div class="chk-item ${d.checklist[i]?'done':''}">
      <input type="checkbox" id="ck${i}" ${d.checklist[i]?'checked':''}><span>${i+1}. ${esc(n)}</span></div>`).join('')}</div>`;
  JACKET_CHECKLIST.forEach((_,i)=>{
    document.getElementById('ck'+i).addEventListener('change',e=>{
      d.checklist[i]=e.target.checked; d.data['jk'+i]=e.target.checked?'1':''; save(); renderChecklist(d,body);
    });
  });
}
let sigTarget=null;
function renderSigs(d, body){
  body.innerHTML = `<div class="notice"><b>Captured signature image — not a certified e-signature.</b> Draw or type-freehand each signature; it is placed on the signature lines as an image.</div>
    <div class="grid2">${SIG_SLOTS.map(s=>`<div class="panel" style="margin:0"><h2>${s.label}</h2>
      ${d.signatures[s.key]?`<img src="${d.signatures[s.key]}" style="max-width:100%;border:1px solid var(--line);border-radius:8px;background:#fff" alt="signature">`:'<p style="color:var(--mut);font-size:13px">No signature captured.</p>'}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn sm" data-sig="${s.key}">Capture</button>
        ${d.signatures[s.key]?`<button class="btn sm ghost" data-csig="${s.key}">Clear</button>`:''}
      </div></div>`).join('')}</div>
    <div class="row" style="margin-top:12px"><label class="f">Signature date (used beside signature lines)<input id="df_sigDate" type="date" value="${esc(d.data.sigDate||'')}"></label></div>`;
  body.querySelectorAll('[data-sig]').forEach(b=>b.onclick=()=>openSig(b.dataset.sig,d));
  body.querySelectorAll('[data-csig]').forEach(b=>b.onclick=()=>{delete d.signatures[b.dataset.csig];save();audit('clear signature',b.dataset.csig);renderSigs(d,body);});
  document.getElementById('df_sigDate').oninput=e=>{d.data.sigDate=e.target.value;save();};
}
/* ---- signature pad ---- */
function openSig(slotKey, deal){
  sigTarget={slotKey,deal};
  const cv=document.getElementById('sigCanvas'), ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height); ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.strokeStyle='#111';
  document.getElementById('sigModal').classList.add('open');
  let drawing=false,lx=0,ly=0;
  const pos=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height];};
  cv.onpointerdown=e=>{drawing=true;[lx,ly]=pos(e);cv.setPointerCapture(e.pointerId);};
  cv.onpointermove=e=>{if(!drawing)return;const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();[lx,ly]=[x,y];};
  cv.onpointerup=()=>drawing=false;
  document.getElementById('sigClear').onclick=()=>ctx.clearRect(0,0,cv.width,cv.height);
  document.getElementById('sigCancel').onclick=()=>document.getElementById('sigModal').classList.remove('open');
  document.getElementById('sigSave').onclick=()=>{
    deal.signatures[slotKey]=cv.toDataURL('image/png');
    save(); audit('capture signature', slotKey+' — '+dealName(deal));
    document.getElementById('sigModal').classList.remove('open');
    renderSigs(deal, document.getElementById('dealBody'));
  };
}

/* ================= documents ================= */
function vDocuments(){
  const el = document.getElementById('view-documents');
  if(!docDealId || !store.deals.some(d=>d.id===docDealId)) docDealId = store.deals[0]?.id || null;
  if(!docDealId){ el.innerHTML='<div class="panel"><h2>Documents</h2><p style="color:var(--mut)">Create a deal first.</p></div>'; return; }
  const d = store.deals.find(x=>x.id===docDealId);
  const tpl = TEMPLATES.find(t=>t.id===docTplId) || TEMPLATES[0];
  const miss = missingFields(d, tpl);
  el.innerHTML = `<div class="panel no-print"><h2>Documents — ${esc(dealName(d))}</h2>
    <div class="tplbar">
      <label class="f" style="min-width:220px">Deal<select id="docDeal">${store.deals.map(x=>`<option value="${x.id}" ${x.id===docDealId?'selected':''}>${esc(dealName(x))}</option>`).join('')}</select></label>
      <label class="f" style="min-width:260px">Template<select id="docTpl">${TEMPLATES.map(t=>`<option value="${t.id}" ${t.id===tpl.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
      <button class="btn sm" id="docPrintOne">🖨 Print this page / PDF</button>
      <button class="btn sm ghost" id="docPrintAll">🖨 Print full package (8 pages)</button>
      <button class="btn sm ghost" id="docCalib">${docCalib?'✓ Nudge mode ON':'Nudge fields'}</button>
      ${docCalib?'<button class="btn sm warn" id="docCalibReset">Reset calibration</button>':''}
    </div>
    <p style="font-size:12.5px;color:var(--mut);margin:0">${esc(tpl.note)} Original scan shown untouched — values are overlays only.</p>
    ${miss.length?`<div class="misslist" style="margin-top:10px"><b>${miss.length} required field${miss.length>1?'s':''} missing</b> (red dashed boxes in preview): ${miss.map(f=>esc(f.id)).join(', ')}</div>`:'<p style="color:var(--pine);font-size:13px">✓ All required fields for this template are filled.</p>'}
    ${docCalib?'<div class="notice"><b>Calibration mode:</b> drag any blue field to nudge it. Offsets save per template in this browser. This is the documented path for fixing template alignment or adding new templates.</div>':''}
  </div>
  <div class="doc-scroll" id="docScroll"></div>
  <p class="no-print" style="font-size:12px;color:var(--mut)">Blue text = your entries overlaid on the untouched original scan. Print or “Save as PDF” from the print dialog to download the package as PDF.</p>`;
  document.getElementById('docDeal').onchange=e=>{docDealId=e.target.value;vDocuments();};
  document.getElementById('docTpl').onchange=e=>{docTplId=e.target.value;vDocuments();};
  document.getElementById('docCalib').onclick=()=>{docCalib=!docCalib;vDocuments();};
  const rst=document.getElementById('docCalibReset');
  if(rst) rst.onclick=()=>{delete store.calib[tpl.id];save();audit('calibrate reset',tpl.id);vDocuments();};
  document.getElementById('docPrintOne').onclick=()=>doPrint('one',tpl,d);
  document.getElementById('docPrintAll').onclick=()=>doPrint('all',tpl,d);
  const host=document.getElementById('docScroll');
  for(const t of TEMPLATES){
    host.appendChild(renderPage(d,t,{sel:t.id===tpl.id, screenHide:t.id!==tpl.id, calib:docCalib&&t.id===tpl.id}));
  }
}
function doPrint(mode, tpl, deal){
  document.body.dataset.print = mode;
  audit('print', `${mode==='all'?'full package (8 pages)':tpl.name} — ${dealName(deal)}`);
  setTimeout(()=>window.print(), 60);
}
window.addEventListener('afterprint', ()=>{ delete document.body.dataset.print; });

/* ================= audit ================= */
function vAudit(){
  const el=document.getElementById('view-audit');
  el.innerHTML=`<div class="panel"><h2>Audit log</h2>
    <div style="overflow-x:auto"><table class="list"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
    <tbody>${store.audit.map(a=>`<tr><td style="white-space:nowrap">${esc(a.ts.slice(0,16).replace('T',' '))}</td><td>${esc(a.user)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`).join('')||'<tr><td colspan="4">Empty.</td></tr>'}</tbody></table></div></div>`;
}

/* ================= about ================= */
function vAbout(){
  const el=document.getElementById('view-about');
  el.innerHTML=`<div class="panel"><h2>About this build</h2>
    <p><b>DealerDoc Filler v2</b> — pilot dealership document automation. Original scans are never modified; the app overlays typed values on the untouched images.</p>
    <h3>Templates (${TEMPLATES.length} pages)</h3>
    <ul>${TEMPLATES.map(t=>`<li><b>${esc(t.name)}</b> — ${esc(t.note)}</li>`).join('')}</ul>
    <p><b>Missing template:</b> loan application page 1 was never provided (contract-pg-1.png is only the tail of the loan app), so no loan-application template is built.</p>
    <h3>Calculations</h3>
    <ul><li>Contract of Sale 31-line chain incl. Utah sales/use tax (rate is an input).</li>
    <li>Finance agreement &amp; Truth in Lending: monthly payment via standard amortization; finance charge and total of payments derived.</li>
    <li>Every calculated field is labeled <i>calculated</i> in the deal form.</li></ul>
    <h3>Calibration = template maintenance</h3>
    <p>Open Documents → <b>Nudge fields</b>, drag any overlay to its exact spot. Offsets are saved per template in this browser. To add or update a template: add the scan to <code>assets/</code>, add an entry to <code>TEMPLATES</code> in <code>app.js</code>, then nudge fields into place.</p>
    <h3>Security &amp; limits</h3>
    <div class="notice"><b>Pilot-grade security.</b> All data (customers, deals, ID photos, signatures) is stored <b>unencrypted in this browser's localStorage</b>. Do not enter real customer PII until a backend with encryption and TLS is added. Demo passwords are hardcoded. No legal or regulatory compliance is claimed. Signature capture produces an image, not a certified e-signature. ID photos can be auto-read on this device (Tesseract.js OCR, photo never leaves the browser) to pre-fill name, DOB, address, and license number — every auto-filled field must still be confirmed manually against the photo.</div>
    <h3>Dealership settings</h3>
    <div class="row"><label class="f">Dealer name<input id="set_dealer" value="${esc(store.settings?.dealerName||'')}"></label>
    <label class="f">Dealer phone<input id="set_phone" value="${esc(store.settings?.dealerPhone||'')}"></label></div>
    <button class="btn sm" id="set_save">Save settings</button>
    <h3>Demo accounts</h3><p><b>admin</b>/admin123 (full access incl. delete + audit) · <b>sales</b>/sales123 · <b>finance</b>/finance123</p>
  </div>`;
  document.getElementById('set_save').onclick=()=>{
    store.settings={dealerName:document.getElementById('set_dealer').value.trim(),dealerPhone:document.getElementById('set_phone').value.trim()};
    save(); audit('settings','dealer settings updated'); alert('Saved.');
  };
}

/* ================= demo mode (?demo=1) =================
 * Seeds one fully-worked EXAMPLE deal (all fake data, clearly labeled) so a
 * reviewer can see every filled document. Runs once, only when the store
 * has no deals yet. Nothing here touches real customer data. */
function demoSignature(){
  const cv = document.createElement('canvas'); cv.width = 520; cv.height = 160;
  const x = cv.getContext('2d');
  x.strokeStyle = '#123f31'; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath();
  let px = 36, py = 110; x.moveTo(px, py);
  const wob = [[70,55],[105,120],[150,60],[195,118],[240,66],[285,116],[330,70],[375,112],[420,72],[470,108]];
  for (const [qx, qy] of wob){ x.quadraticCurveTo(px, py, (px+qx)/2, (py+qy)/2); px = qx; py = qy; }
  x.stroke();
  x.beginPath(); x.moveTo(36, 138); x.quadraticCurveTo(260, 152, 492, 128); x.stroke();
  return cv.toDataURL('image/png');
}
function seedDemo(){
  store.settings = { dealerName: 'Wasatch Auto Sales', dealerPhone: '(801) 555-0147' };
  const cust = { id: uid('c'), verify: {},
    name: 'Miguel Hernández', dob: '03/22/1988',
    streetAddress: '4567 W 3500 S', city: 'West Valley City', county: 'Salt Lake',
    state: 'UT', zip: '84120', resPhone: '(801) 555-0134', busPhone: '(801) 555-0199',
    email: 'miguel.h@example.com', dlNo: '123456789',
    notes: 'EXAMPLE record — seeded by ?demo=1' };
  const veh = { id: uid('v'), vin: 'JF2GTACC3JH276452', year: '2018', make: 'Subaru',
    model: 'Crosstrek', trim: 'Premium', bodyType: 'SUV', engine: '2.0L H4', cyl: '4',
    color: 'Crystal White Pearl', mileage: '50234', stockNo: 'P1842', condition: 'USED' };
  store.customers.push(cust); store.vehicles.push(veh);
  const today = todayISO();
  const data = {
    purchaserName: cust.name, streetAddress: cust.streetAddress, city: cust.city,
    county: cust.county, state: cust.state, zip: cust.zip,
    resPhone: cust.resPhone, busPhone: cust.busPhone, dlNo: cust.dlNo,
    year: veh.year, make: veh.make, series: veh.model, bodyType: veh.bodyType,
    cyl: veh.cyl, color: veh.color, vin: veh.vin, odometer: veh.mileage,
    stockNo: veh.stockNo, cond: veh.condition,
    dateOfSale: today, delDate: today, salesperson: 'Abraham Valadez',
    dealerName: store.settings.dealerName, titledIn: cust.name, status: 'ready',
    discChoice: 'A', intRateFrom: '8.9', intRateTo: '11.9',
    termFrom: '48', termTo: '72', payFrom: '350', payTo: '450',
    line1: '18995', line2: '899', line7: '500', taxRate: '7.25',
    tradeYearMake: '2015 Honda Civic', tradeOdometer: '98700', tradeSeries: 'LX',
    tradeBodyType: 'Sedan', tradeVin: '2HGFB2F50FH512345',
    tradeAddress: '4567 W 3500 S, West Valley City, UT 84120',
    balanceOwedTo: 'Granite Credit Union', payoffVerifiedBy: 'L. Gomez',
    goodUntil: '11/15/2026', dateOfVerification: today, accNo: '882134',
    line10: '8000', line11: '5200', line13: '1500',
    line16: '1899', line17: '399', line23: '285', line24: '120',
    line25: '45', line26: '8',
    finRate: '9.9', finMonths: '60',
    payStartMonth: '12', payStartDay: '01', payStartYear: '2026',
    insuranceCo: 'Bear River Mutual', policyNo: 'BRM-88213', finInitials: 'MH',
    tilDueDay: '1',
    odoUnit: 'miles', odoCert: 'actual',
    odoTAddr: '789 W Dealer Way', odoTCity: 'West Valley City',
    odoTState: 'UT', odoTZip: '84119',
    jSerial: veh.vin, jLicense: '8X7K2P', jTab: 'T-4412', jExp: '11/26', jKey: 'K-209',
    jPurchFrom: 'Wasatch Auto Sales', jPurchAddr: '789 W Dealer Way',
    jPurchCity: 'West Valley City', jPurchState: 'UT', jPurchZip: '84119',
    jPurchPhone: '(801) 555-0147', jCostEquity: '14500', jPayoff: '5200',
    jCommission: '450', jRSNo: 'RS-2201', jAmtDOL: '285', jCertTitle: '6',
    jRegist: '120', jTotalOfficial: '411', jInsCo: 'Bear River Mutual', jSmog: '45',
    jJacketTotal: '18842.67', jRemCash: '0', jPayableAmt: '399.42',
    jPayableOn: '1st', jPayableYr: '26', jBeginOn: '12/01/2026',
    sigDate: today,
    docReg: '1', docOdo: '1', docPayoff: '1', titleChk: '1',
  };
  const sig = demoSignature();
  const deal = { id: uid('d'), customerId: cust.id, vehicleId: veh.id, data,
    signatures: { sig_purchaser: sig, sig_seller: sig, sig_lender: sig, sig_buyer: sig },
    checklist: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  for (let i = 0; i < 24; i++){
    if (![5, 11, 17, 22].includes(i)){ deal.checklist[i] = true; deal.data['jk'+i] = '1'; }
  }
  store.deals.push(deal);
  save();
  audit('demo seed', 'example deal created (?demo=1)');
}
if (typeof location !== 'undefined'
    && new URLSearchParams(location.search).get('demo') === '1'
    && store.deals.length === 0){
  try { seedDemo(); } catch(e){ console.warn('demo seed failed', e); }
}

/* ================= login / init ================= */
function doLogin(){
  const u=document.getElementById('loginUser').value.trim(), p=document.getElementById('loginPass').value;
  const rec=USERS[u];
  if(!rec || rec.pw!==p){ document.getElementById('loginErr').textContent='Invalid credentials.'; return; }
  session={user:u,role:rec.role,ts:new Date().toISOString()};
  sessionStorage.setItem('dd_v2_session',JSON.stringify(session));
  audit('login', u+' ('+rec.role+')');
  enterApp();
}
function enterApp(){
  document.getElementById('loginView').style.display='none';
  document.getElementById('appView').style.display='';
  document.getElementById('userBadge').textContent=session.user+' · '+USERS[session.user].label;
  renderTabs(); showView('dashboard');
}
document.getElementById('loginBtn').onclick=doLogin;
document.getElementById('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('logoutBtn').onclick=()=>{
  audit('logout',session.user); session=null; sessionStorage.removeItem('dd_v2_session');
  document.getElementById('appView').style.display='none';
  document.getElementById('loginView').style.display='flex';
};
if(session && USERS[session.user]) enterApp();
