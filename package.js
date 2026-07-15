{
  "name": "private-scholarship-contracts",
  "version": "1.0.0",
  "description": "Smart contracts for Private Scholarship Distribution MVP",
  "main": "index.js",
  "scripts": {
    "test": "hardhat test",
    "compile": "hardhat compile",
    "deploy:local": "hardhat run scripts/deploy.js --network localhost",
    "deploy:fuji": "hardhat run scripts/deploy.js --network fuji"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.2"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "dotenv": "^16.4.5",
    "hardhat": "^2.22.5"
  }
}
