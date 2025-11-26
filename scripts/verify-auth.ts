
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:5001';

async function verifyAuth() {
    console.log('Starting Authentication & Multi-tenancy Verification...');

    // 1. Register User A
    const userA = { username: `userA_${Date.now()}`, password: 'password123' };
    console.log(`\n[1] Registering User A (${userA.username})...`);
    const regResA = await fetch(`${BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userA),
    });

    if (!regResA.ok) {
        console.error('Failed to register User A:', await regResA.text());
        process.exit(1);
    }
    const userDataA = await regResA.json();
    console.log('User A registered:', userDataA.id);

    // 2. Login User A (to get cookie)
    console.log(`\n[2] Logging in User A...`);
    const loginResA = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userA),
    });

    if (!loginResA.ok) {
        console.error('Failed to login User A:', await loginResA.text());
        process.exit(1);
    }
    const cookieA = loginResA.headers.get('set-cookie');
    assert(cookieA, 'Login should return a cookie');
    console.log('User A logged in. Cookie obtained.');

    // 3. Create Project for User A
    console.log(`\n[3] Creating Project for User A...`);
    const projectA = {
        title: 'User A Project',
        genre: 'Fantasy',
        description: 'A project by User A',
    };
    const createProjResA = await fetch(`${BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieA
        },
        body: JSON.stringify(projectA),
    });

    if (!createProjResA.ok) {
        console.error('Failed to create project for User A:', await createProjResA.text());
        process.exit(1);
    }
    const projectDataA = await createProjResA.json();
    console.log('User A Project created:', projectDataA.id);

    // 4. Logout User A
    console.log(`\n[4] Logging out User A...`);
    await fetch(`${BASE_URL}/api/logout`, {
        method: 'POST',
        headers: { 'Cookie': cookieA },
    });

    // 5. Register User B
    const userB = { username: `userB_${Date.now()}`, password: 'password123' };
    console.log(`\n[5] Registering User B (${userB.username})...`);
    const regResB = await fetch(`${BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userB),
    });

    if (!regResB.ok) {
        console.error('Failed to register User B:', await regResB.text());
        process.exit(1);
    }
    const userDataB = await regResB.json();
    console.log('User B registered:', userDataB.id);

    // 6. Login User B
    console.log(`\n[6] Logging in User B...`);
    const loginResB = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userB),
    });
    const cookieB = loginResB.headers.get('set-cookie');
    assert(cookieB, 'Login should return a cookie');

    // 7. Verify Isolation: User B tries to access User A's project
    console.log(`\n[7] Verifying Isolation: User B accessing User A's project...`);
    const accessRes = await fetch(`${BASE_URL}/api/projects/${projectDataA.id}`, {
        method: 'GET',
        headers: { 'Cookie': cookieB },
    });

    if (accessRes.status === 403 || accessRes.status === 404) {
        console.log('SUCCESS: User B denied access to User A\'s project (Status:', accessRes.status, ')');
    } else {
        console.error('FAILURE: User B could access User A\'s project! Status:', accessRes.status);
        process.exit(1);
    }

    // 8. Verify Isolation: User B tries to list projects (should not see User A's)
    console.log(`\n[8] Verifying Isolation: User B listing projects...`);
    const listRes = await fetch(`${BASE_URL}/api/projects`, {
        method: 'GET',
        headers: { 'Cookie': cookieB },
    });
    const projectsB = await listRes.json();
    const hasUserAProject = projectsB.some((p: any) => p.id === projectDataA.id);

    if (!hasUserAProject) {
        console.log('SUCCESS: User B cannot see User A\'s project in list.');
    } else {
        console.error('FAILURE: User B can see User A\'s project in list!');
        process.exit(1);
    }

    console.log('\nVerification Complete: All checks passed!');
}

verifyAuth().catch(console.error);
