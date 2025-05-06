import dotenv from 'dotenv';
dotenv.config();

console.log('Loaded environment variables:');
console.log('- discord_bot_token:', process.env.discord_bot_token ? '[PRESENT]' : '[MISSING]');
console.log('- discord_bot_id:', process.env.discord_bot_id);
console.log('- discord_bot_secret:', process.env.discord_bot_secret ? '[PRESENT]' : '[MISSING]');
console.log('- DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID);
console.log('- DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? '[PRESENT]' : '[MISSING]');

// List all environment variables with 'secret' in the name
console.log('\nAll secret-related vars:');
Object.keys(process.env)
    .filter(key => key.toLowerCase().includes('secret'))
    .forEach(key => console.log(`- ${key}: ${process.env[key] ? '[PRESENT]' : '[MISSING]'}`));
