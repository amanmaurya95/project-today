const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
async function main() {
  const [deployer, student, auditor] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  // 1. Deploy Mock ERC20 Token
  const initialSupply = hre.ethers.parseEther("1000000"); // 1M SCHOL
  const Token = await hre.ethers.getContractFactory("MockScholarshipToken");
  const token = await Token.deploy("Mock Scholarship Token", "SCHOL", initialSupply);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockScholarshipToken deployed to:", tokenAddress);
  // 2. Deploy PrivateScholarshipVault
  // We use the second test account as the auditor for testing purposes
  const auditorAddress = auditor ? auditor.address : deployer.address;
  const Vault = await hre.ethers.getContractFactory("PrivateScholarshipVault");
  const vault = await Vault.deploy(tokenAddress, auditorAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("PrivateScholarshipVault deployed to:", vaultAddress);
  console.log("Assigned Auditor Address:", auditorAddress);
  // 3. Export ABIs and Addresses to Frontend
  const frontendContractsDir = path.join(__dirname, "../../frontend/src/contracts");
  
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }
  // Get artifacts
  const tokenArtifact = hre.artifacts.readArtifactSync("MockScholarshipToken");
  const vaultArtifact = hre.artifacts.readArtifactSync("PrivateScholarshipVault");
  // Write files
  fs.writeFileSync(
    path.join(frontendContractsDir, "MockScholarshipToken.json"),
    JSON.stringify(tokenArtifact, null, 2)
  );
  fs.writeFileSync(
    path.join(frontendContractsDir, "PrivateScholarshipVault.json"),
    JSON.stringify(vaultArtifact, null, 2)
  );
  fs.writeFileSync(
    path.join(frontendContractsDir, "addresses.json"),
    JSON.stringify({
      token: tokenAddress,
      vault: vaultAddress,
      auditor: auditorAddress,
      university: deployer.address,
      student: student ? student.address : ""
    }, null, 2)
  );
  console.log("Frontend contract metadata files generated successfully in:", frontendContractsDir);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
