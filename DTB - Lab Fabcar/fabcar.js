'use strict'; 
const { Contract } = require('fabric-contract-api'); 
 
class FabCar extends Contract { 
 
    async initLedger(ctx) { 
        console.info('============= START : Initialize Ledger ==========='); 
        const cars = [ 
            { 
                make: 'Toyota', 
                model: 'Prius', 
 
                color: 'blue', 
                owner: 'Tomoko', 
            }, 
            { 
                make: 'Ford', 
                model: 'Mustang', 
                color: 'red', 
                owner: 'Brad', 
            }, 
            // Agrega más autos según sea necesario 
        ]; 
 
        for (let i = 0; i < cars.length; i++) { 
            cars[i].docType = 'car'; 
            await ctx.stub.putState('CAR' + i, 
Buffer.from(JSON.stringify(cars[i]))); 
            console.info('Added <--> ', cars[i]); 
        } 
        console.info('============= END : Initialize Ledger ==========='); 
    } 
 
    async queryCar(ctx, carNumber) { 
        const carAsBytes = await ctx.stub.getState(carNumber); 
        if (!carAsBytes || carAsBytes.length === 0) { 
            throw new Error(`${carNumber} does not exist`); 
        } 
        console.log(carAsBytes.toString()); 
        return carAsBytes.toString(); 
    } 
 
    async createCar(ctx, carNumber, make, model, color, owner) { 
        console.info('============= START : Create Car ==========='); 
        const car = { 
            docType: 'car', 
            make, 
            model, 
            color, 
            owner, 
        }; 
 
        await ctx.stub.putState(carNumber, 
Buffer.from(JSON.stringify(car))); 
        console.info('============= END : Create Car ==========='); 
    } 
 
    async queryAllCars(ctx) { 
        const startKey = 'CAR0'; 
        const endKey = 'CAR999'; 
        const iterator = await ctx.stub.getStateByRange(startKey, endKey); 
 
        const allResults = []; 
        while (true) { 
            const res = await iterator.next(); 
            if (res.value && res.value.value.toString()) { 
                console.log(res.value.value.toString()); 
                allResults.push(res.value.value.toString()); 
            } 
            if (res.done) { 
                console.log('end of data'); 
                await iterator.close(); 
                return allResults; 
            } 
        } 
    } 
 
    async changeCarOwner(ctx, carNumber, newOwner) { 
        console.info('============= START : Change Car Owner ==========='); 
        const carAsBytes = await ctx.stub.getState(carNumber); 
        if (!carAsBytes || carAsBytes.length === 0) { 
            throw new Error(`${carNumber} does not exist`); 
        } 
        const car = JSON.parse(carAsBytes.toString()); 
        car.owner = newOwner; 
 
        await ctx.stub.putState(carNumber, 
Buffer.from(JSON.stringify(car))); 
        console.info('============= END : Change Car Owner ==========='); 
    } 
 
 async GetCarHistory(ctx, carNumber) { 
let resultsIterator = await ctx.stub.getHistoryForKey(carNumber); 
let results = await this._GetAllResults(resultsIterator, true); 
return JSON.stringify(results); 
} 
async _GetAllResults(iterator, parse) { 
const allResults = []; 
while (true) { 
const res = await iterator.next(); 
if (res.value && res.value.value.toString()) { 
const result = parse 
? JSON.parse(res.value.value.toString()) 
: res.value.value.toString(); 
allResults.push(result); 
} 
if (res.done) { 
await iterator.close(); 
return allResults; 
} 
} 
} 
} 
module.exports = FabCar;