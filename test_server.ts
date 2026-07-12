async function run() {
  console.log('Sending requests to active dev server on port 3300...');

  // Let's first read the storage directory files to find which logos are actually there right now
  const fs = require('fs');
  const path = require('path');
  const dirPath = path.join(process.cwd(), 'storage', 'logos');
  console.log('Logos directory exists:', fs.existsSync(dirPath));
  if (fs.existsSync(dirPath)) {
    console.log('Logos files:', fs.readdirSync(dirPath));
  }

  // Let's fetch one of the filenames
  const files = fs.readdirSync(dirPath);
  if (files.length > 0) {
    const filename = files[0];
    console.log(`\n--- Fetching /uploads/logos/${filename} ---`);
    try {
      const res = await fetch(`http://localhost:3300/uploads/logos/${filename}`);
      console.log('Status:', res.status);
      console.log('Headers:', Object.fromEntries(res.headers.entries()));
      const text = await res.text();
      console.log('Body snippet:', text.slice(0, 200));
    } catch (err: any) {
      console.error('Fetch error:', err.message);
    }

    console.log(`\n--- Fetching /api/uploads/logos/${filename} ---`);
    try {
      const res = await fetch(`http://localhost:3300/api/uploads/logos/${filename}`);
      console.log('Status:', res.status);
      console.log('Headers:', Object.fromEntries(res.headers.entries()));
      const text = await res.text();
      console.log('Body snippet:', text.slice(0, 200));
    } catch (err: any) {
      console.error('Fetch error:', err.message);
    }
  } else {
    console.log('No logos found in storage/logos!');
  }
}

run();
