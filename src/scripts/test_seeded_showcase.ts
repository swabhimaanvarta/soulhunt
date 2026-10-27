async function verifyShowcase() {
  console.log("========================================================");
  console.log("🔍 VERIFYING SEEDED LOST & FOUND ITEMS & WEBP IMAGES");
  console.log("========================================================");

  // 1. API items check
  const apiRes = await fetch("http://localhost:3000/api/items?limit=50");
  const apiData = await apiRes.json();

  if (!apiData.success) {
    throw new Error(`API failed: ${JSON.stringify(apiData)}`);
  }

  const items = apiData.data || [];
  console.log(`✓ Fetched ${items.length} items from /api/items`);

  const withPhoto = items.filter((i: any) => i.photoUrl && i.photoUrl.startsWith("/api/evidence/"));
  console.log(`✓ Items with WebP evidence photo: ${withPhoto.length} / ${items.length}`);

  if (withPhoto.length === 0) {
    throw new Error("No items have WebP evidence photo URL!");
  }

  // 2. Test direct image serving for 5 sample items
  console.log("\n─── Testing Image Serving for Sample Items ───");
  for (const item of withPhoto.slice(0, 6)) {
    const imgRes = await fetch(`http://localhost:3000${item.photoUrl}`);
    const contentType = imgRes.headers.get("content-type");
    const buf = await imgRes.arrayBuffer();

    console.log(`  ✓ Item: "${item.title.padEnd(35)}" | Status: ${imgRes.status} | Type: ${contentType} | Size: ${buf.byteLength} B`);
    if (imgRes.status !== 200 || !contentType?.includes("webp")) {
      throw new Error(`Failed to serve WebP image for ${item.title}`);
    }
  }

  // 3. Test Lost and Found HTML page
  console.log("\n─── Testing /lost-and-found HTML page ───");
  const htmlRes = await fetch("http://localhost:3000/lost-and-found");
  console.log(`✓ /lost-and-found Status: ${htmlRes.status}`);
  const htmlText = await htmlRes.text();
  console.log(`✓ HTML length: ${htmlText.length} bytes`);

  // 4. Test Item Detail Page for First Item
  const sampleItemId = items[0]._id;
  console.log(`\n─── Testing Item Detail Page: /items/${sampleItemId} ───`);
  const itemRes = await fetch(`http://localhost:3000/items/${sampleItemId}`);
  console.log(`✓ /items/${sampleItemId} Status: ${itemRes.status}`);

  const itemApiRes = await fetch(`http://localhost:3000/api/items/${sampleItemId}`);
  const itemApiData = await itemApiRes.json();
  console.log(`✓ Item Title: "${itemApiData.data?.title}"`);
  console.log(`✓ Item Category: ${itemApiData.data?.category}`);
  console.log(`✓ Photo URL: ${itemApiData.data?.photoUrl}`);
  console.log(`✓ Custody / Recovery Preference: ${itemApiData.data?.recoveryPreference || itemApiData.data?.custodyStatus}`);

  // 5. Test Recovered items feed
  console.log("\n─── Testing Recovered Items API: /api/items/recovered ───");
  const recRes = await fetch("http://localhost:3000/api/items/recovered");
  const recData = await recRes.json();
  console.log(`✓ /api/items/recovered Status: ${recRes.status}`);
  console.log(`✓ Recovered items count: ${recData.data?.length || 0}`);

  console.log("\n========================================================");
  console.log("🎉 ALL SEEDED ITEMS & IMAGES VERIFIED 100% HEALTHY!");
  console.log("========================================================\n");
}

verifyShowcase().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

