import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function verifyNextConfigRedirects() {
  console.log("========================================================");
  console.log("🔍 CHECK 1: next.config.mjs Redirects Evaluation");
  console.log("========================================================");

  const nextConfigModule = await import("../../next.config.mjs");
  const nextConfig = nextConfigModule.default;

  assert(typeof nextConfig.redirects === "function", "nextConfig.redirects must be a function");

  const redirectsFn = nextConfig.redirects as () => Promise<any[]>;
  const redirects = await redirectsFn();
  console.log("Configured redirects:", JSON.stringify(redirects, null, 2));

  assert(Array.isArray(redirects), "redirects() must return an array");
  assert(redirects.length >= 5, `Expected at least 5 redirects, got ${redirects.length}`);

  const requiredMappings: Record<string, string> = {
    "/signup": "/register",
    "/signin": "/login",
    "/inventory": "/profile?tab=locker",
    "/items/lost": "/lost-and-found/report-lost",
    "/items/found": "/lost-and-found/report-found",
  };

  for (const [source, expectedDest] of Object.entries(requiredMappings)) {
    const match = redirects.find((r: any) => r.source === source);
    assert(!!match, `Missing redirect for source: '${source}'`);
    assert(
      match.destination === expectedDest,
      `Expected source '${source}' to redirect to '${expectedDest}', got '${match?.destination}'`
    );
    assert(
      match.permanent === false,
      `Expected redirect for '${source}' to be temporary (permanent: false), got ${match?.permanent}`
    );
    console.log(`  ✅ Redirect '${source}' -> '${expectedDest}' (permanent: false) verified.`);
  }
}

async function verifyItemDetailErrorBoundary() {
  console.log("\n========================================================");
  console.log("🔍 CHECK 2: Item Detail Error Boundary (src/app/items/[id]/error.tsx)");
  console.log("========================================================");

  const filePath = path.resolve(__dirname, "../app/items/[id]/error.tsx");
  assert(fs.existsSync(filePath), `File does not exist: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  assert(fileContent.trimStart().startsWith('"use client"'), 'File must start with "use client" directive');
  assert(fileContent.includes("error: Error & { digest?: string }"), "Must have standard props typing for error");
  assert(fileContent.includes("reset: () => void"), "Must have standard props typing for reset");
  assert(fileContent.includes('href="/lost-and-found"'), "Must contain Link to /lost-and-found");
  assert(fileContent.includes("reset()"), "Must call reset() in recovery button");

  console.log("  ✅ Static contract inspection passed ('use client', props typing, reset callback, directory link).");

  // Dynamic import and component evaluation
  const mod = await import("../app/items/[id]/error");
  const ItemDetailError = mod.default;
  assert(typeof ItemDetailError === "function", "Default export must be a React component function");

  // Render test 1: standard error
  let resetCalled = false;
  const mockReset = () => { resetCalled = true; };
  const standardError = new Error("Custom Belonging Ledger Failure");
  
  const html1 = ReactDOMServer.renderToString(
    React.createElement(ItemDetailError, { error: standardError, reset: mockReset })
  );

  assert(html1.includes("Custom Belonging Ledger Failure"), "Rendered HTML must contain error message");
  assert(html1.includes("/lost-and-found"), "Rendered HTML must contain href to /lost-and-found");
  assert(html1.includes("Try Again"), "Rendered HTML must contain 'Try Again' reset button");
  assert(html1.includes("Item Not Found or Investigation Unavailable"), "Rendered HTML must contain heading");
  console.log("  ✅ Render Test 1 (Standard Error) succeeded.");

  // Render test 2: fallback message & digest
  const errorWithDigest: Error & { digest?: string } = new Error("");
  errorWithDigest.digest = "DIGEST_SEC_9921_X";

  const html2 = ReactDOMServer.renderToString(
    React.createElement(ItemDetailError, { error: errorWithDigest, reset: mockReset })
  );

  assert(html2.includes("The requested belonging record could not be retrieved"), "Must fall back to default message when message is empty");
  assert(html2.includes("DIGEST_SEC_9921_X"), "Must render error.digest when present");
  console.log("  ✅ Render Test 2 (Fallback & Digest) succeeded.");
}

async function verifyItemDetailLoadingSkeleton() {
  console.log("\n========================================================");
  console.log("🔍 CHECK 3: Item Detail Loading Skeleton (src/app/items/[id]/loading.tsx)");
  console.log("========================================================");

  const filePath = path.resolve(__dirname, "../app/items/[id]/loading.tsx");
  assert(fs.existsSync(filePath), `File does not exist: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  assert(fileContent.includes("animate-pulse"), "Loading skeleton must include animate-pulse class");
  assert(fileContent.includes("glass-panel"), "Loading skeleton must include glass-panel container");

  const mod = await import("../app/items/[id]/loading");
  const ItemDetailLoading = mod.default;
  assert(typeof ItemDetailLoading === "function", "Default export must be a React component function");

  const html = ReactDOMServer.renderToString(React.createElement(ItemDetailLoading));
  assert(html.includes("animate-pulse"), "Rendered HTML must include animate-pulse");
  assert(html.includes("glass-panel"), "Rendered HTML must include glass-panel");
  assert(html.includes("max-w-5xl"), "Rendered HTML must mirror page container width");
  console.log("  ✅ Loading skeleton static evaluation and SSR rendering succeeded.");
}

async function verifyStaffErrorBoundary() {
  console.log("\n========================================================");
  console.log("🔍 CHECK 4: Staff Safe-Desk Error Boundary (src/app/staff/error.tsx)");
  console.log("========================================================");

  const filePath = path.resolve(__dirname, "../app/staff/error.tsx");
  assert(fs.existsSync(filePath), `File does not exist: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, "utf-8");
  assert(fileContent.trimStart().startsWith('"use client"'), 'File must start with "use client" directive');
  assert(fileContent.includes("error: Error & { digest?: string }"), "Must have standard props typing for error");
  assert(fileContent.includes("reset: () => void"), "Must have standard props typing for reset");
  assert(fileContent.includes('href="/dashboard"'), "Must contain Link to /dashboard");
  assert(fileContent.includes("reset()"), "Must call reset() in recovery button");

  console.log("  ✅ Static contract inspection passed ('use client', props typing, reset callback, dashboard link).");

  // Dynamic import and component evaluation
  const mod = await import("../app/staff/error");
  const StaffStationError = mod.default;
  assert(typeof StaffStationError === "function", "Default export must be a React component function");

  // Render test 1: standard error
  let resetCalled = false;
  const mockReset = () => { resetCalled = true; };
  const standardError = new Error("Custody Queue Offline Exception");

  const html1 = ReactDOMServer.renderToString(
    React.createElement(StaffStationError, { error: standardError, reset: mockReset })
  );

  assert(html1.includes("Custody Queue Offline Exception"), "Rendered HTML must contain error message");
  assert(html1.includes("/dashboard"), "Rendered HTML must contain href to /dashboard");
  assert(html1.includes("Try Again"), "Rendered HTML must contain 'Try Again' reset button");
  assert(html1.includes("Safe-Desk Operations Unavailable"), "Rendered HTML must contain heading");
  console.log("  ✅ Render Test 1 (Standard Error) succeeded.");

  // Render test 2: fallback message & digest
  const errorWithDigest: Error & { digest?: string } = new Error("");
  errorWithDigest.digest = "STATION_FAULT_8832_ALPHA";

  const html2 = ReactDOMServer.renderToString(
    React.createElement(StaffStationError, { error: errorWithDigest, reset: mockReset })
  );

  assert(html2.includes("Failed to initialize custody queue"), "Must fall back to default message when message is empty");
  assert(html2.includes("STATION_FAULT_8832_ALPHA"), "Must render error.digest when present");
  console.log("  ✅ Render Test 2 (Fallback & Digest) succeeded.");
}

async function main() {
  await verifyNextConfigRedirects();
  await verifyItemDetailErrorBoundary();
  await verifyItemDetailLoadingSkeleton();
  await verifyStaffErrorBoundary();

  console.log("\n========================================================");
  console.log("🎉 ALL PR-2 ROUTING & ERROR BOUNDARY CHECKS PASSED EMPIRICALLY");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("❌ EMPIRICAL CHALLENGER FAILED:", err);
  process.exit(1);
});
