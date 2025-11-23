
import { WorldGenerator } from './world-generator';

async function verifyFixes() {
    console.log('Verifying WorldGenerator fixes...');
    const generator = new WorldGenerator();

    // Test 1: Horror template
    const horrorTemplate = generator.getGenreTemplate('恐怖');
    if (horrorTemplate.genre === '恐怖' && horrorTemplate.requiredElements.includes('rules')) {
        console.log('✅ Horror template found and correct.');
    } else {
        console.error('❌ Horror template missing or incorrect:', horrorTemplate);
        process.exit(1);
    }

    // Test 2: Keyword mapping for Horror
    const thrillerTemplate = generator.getGenreTemplate('惊悚');
    if (thrillerTemplate.genre === '恐怖') {
        console.log('✅ Keyword "惊悚" correctly maps to Horror.');
    } else {
        console.error('❌ Keyword "惊悚" failed to map to Horror:', thrillerTemplate);
        process.exit(1);
    }

    // Test 3: Suspense template
    const suspenseTemplate = generator.getGenreTemplate('悬疑');
    if (suspenseTemplate.genre === '悬疑') {
        console.log('✅ Suspense template found.');
    } else {
        console.error('❌ Suspense template missing:', suspenseTemplate);
        process.exit(1);
    }

    console.log('All WorldGenerator verifications passed!');
}

verifyFixes().catch(console.error);
