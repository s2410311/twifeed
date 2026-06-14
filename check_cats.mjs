import db from './db/index.js';
const cats = db.prepare('SELECT * FROM categories').all();
console.log('categories count:', cats.length);
console.log(JSON.stringify(cats));
