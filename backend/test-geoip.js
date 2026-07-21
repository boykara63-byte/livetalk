const geoip = require("geoip-lite");

const testIPs = [
  { ip: "8.8.8.8", expected: "US" },
  { ip: "1.1.1.1", expected: "US" },
  { ip: "185.60.114.159", expected: "IE" },
  { ip: "127.0.0.1", expected: null },
  { ip: "::1", expected: null },
  { ip: "192.168.1.1", expected: null },
];

console.log("Test geoip-lite detection:");
for (const { ip, expected } of testIPs) {
  const lookup = geoip.lookup(ip);
  const country = lookup?.country || null;
  const status = country === expected ? "OK" : "MISMATCH";
  console.log(`  ${status}  IP=${ip}  detected=${country}  expected=${expected}`);
}
