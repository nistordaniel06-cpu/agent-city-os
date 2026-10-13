'use strict';
/** Conservative cost estimator, not a claim about market prices or delivery deadlines. */
function estimate({minimumHours,maximumHours,hourlyRate,expenses=0,marginPercent=20}={}){
 const h1=Number(minimumHours),h2=Number(maximumHours),rate=Number(hourlyRate),cost=Number(expenses),margin=Number(marginPercent);
 if(![h1,h2,rate,cost,margin].every(Number.isFinite)||h1<=0||h2<h1||h2>2000||rate<=0||rate>10000||cost<0||cost>10000000||margin<0||margin>70)throw new Error('Date estimate invalide.');
 const factor=1/(1-margin/100);
 const round=v=>Math.ceil(v*100)/100;
 return {low:round((h1*rate+cost)*factor),high:round((h2*rate+cost)*factor),workHours:{min:h1,max:h2},hourlyRate:rate,expenses:cost,marginPercent:margin,disclaimer:'Estimare internă orientativă, nu preț de piață, ofertă trimisă sau termen garantat.'};
}
module.exports={estimate};
