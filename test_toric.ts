import { calculateToricJS } from './src/calculators/astigmatism';

console.log("Test 1: K1=43, K2=45, AX1=180 (Flat Axis=180, Steep Axis=90)");
const res1 = calculateToricJS(43, 45, 180, 0.1, 90, 23.5);
console.log("Steep Axis output:", res1.total_steep_axis);

console.log("Test 2: K1=43, K2=45, AX1=90 (Flat Axis=90, Steep Axis=180)");
const res2 = calculateToricJS(43, 45, 90, 0.1, 90, 23.5);
console.log("Steep Axis output:", res2.total_steep_axis);
