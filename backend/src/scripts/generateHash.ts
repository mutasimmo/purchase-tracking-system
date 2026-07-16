// backend/src/scripts/generateHash.ts
import bcrypt from 'bcryptjs';

const password = 'Admin@2024#Secure!NEW';
const saltRounds = 12;

const hash = await bcrypt.hash(password, saltRounds);
console.log('✅ Hash الصحيح:');
console.log(hash);
console.log('\n📝 كلمة المرور:', password);