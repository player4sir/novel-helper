
import { extractJSON } from './utils/json-extractor';

function verifyEnhancements() {
    console.log('Verifying JSON Extractor Enhancements...');

    // Test Case 1: Unescaped quotes in value
    const badJson1 = `
  {
    "name": "Test Character",
    "description": "He said "Hello" to the world",
    "role": "protagonist"
  }
  `;

    try {
        const result1 = extractJSON(badJson1);
        if (result1.description === 'He said "Hello" to the world') {
            console.log('✅ Test 1 Passed: Fixed unescaped quotes in value');
        } else {
            console.error('❌ Test 1 Failed: Incorrect parsing', result1);
        }
    } catch (e: any) {
        console.error('❌ Test 1 Failed: ' + e.message);
    }

    // Test Case 2: Chinese characters with unescaped quotes
    const badJson2 = `
  {
    "name": "李小胖",
    "background": "他觉得这个世界"非常有意思"，但是也很危险"
  }
  `;

    try {
        const result2 = extractJSON(badJson2);
        if (result2.background === '他觉得这个世界"非常有意思"，但是也很危险') {
            console.log('✅ Test 2 Passed: Fixed Chinese text with unescaped quotes');
        } else {
            console.error('❌ Test 2 Failed: Incorrect parsing', result2);
        }
    } catch (e: any) {
        console.error('❌ Test 2 Failed: ' + e.message);
    }

    console.log('Verification Complete');
}

verifyEnhancements();
