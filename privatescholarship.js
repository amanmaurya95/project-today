const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("PrivateScholarship System", function () {
  let Token, token;
  let Vault, vault;
  let owner, student, auditor, otherUser;
  const initialSupply = ethers.parseEther("1000000"); // 1M tokens
  beforeEach(async function () {
    [owner, student, auditor, otherUser] = await ethers.getSigners();
    // Deploy Mock ERC20 Token
    Token = await ethers.getContractFactory("MockScholarshipToken");
    token = await Token.deploy("Mock Scholarship Token", "SCHOL", initialSupply);
    await token.waitForDeployment();
    // Deploy Vault
    Vault = await ethers.getContractFactory("PrivateScholarshipVault");
    vault = await Vault.deploy(await token.getAddress(), auditor.address);
    await vault.waitForDeployment();
    // Approve Vault to spend owner's tokens
    await token.approve(await vault.getAddress(), initialSupply);
  });
  describe("Initialization", function () {
    it("Should set the correct token address and owner", async function () {
      expect(await vault.scholarshipToken()).to.equal(await token.getAddress());
      expect(await vault.owner()).to.equal(owner.address);
    });
    it("Should set the correct initial auditor", async function () {
      expect(await vault.auditor()).to.equal(auditor.address);
    });
  });
  describe("Student Registration", function () {
    it("Should allow a student to register their public key", async function () {
      const pubKey = ethers.hexlify(ethers.randomBytes(33)); // mock compressed public key
      await expect(vault.connect(student).registerPublicKey(pubKey))
        .to.emit(vault, "PublicKeyRegistered")
        .withArgs(student.address, pubKey);
      expect(await vault.getStudentPublicKey(student.address)).to.equal(pubKey);
    });
  });
  describe("Awarding Scholarships", function () {
    const encryptedData = "encrypted-aes-payload-string";
    const amount = ethers.parseEther("1000"); // 1000 SCHOL
    let amountHash;
    beforeEach(async function () {
      amountHash = ethers.keccak256(ethers.toUtf8Bytes("1000-salt"));
      const pubKey = ethers.hexlify(ethers.randomBytes(33));
      await vault.connect(student).registerPublicKey(pubKey);
    });
    it("Should allow the owner to award a scholarship", async function () {
      const initialVaultBalance = await token.balanceOf(await vault.getAddress());
      
      await expect(vault.awardScholarship(student.address, encryptedData, amountHash, amount))
        .to.emit(vault, "ScholarshipAwarded")
        .withArgs(student.address, 0, amountHash);
      const finalVaultBalance = await token.balanceOf(await vault.getAddress());
      expect(finalVaultBalance - initialVaultBalance).to.equal(amount);
      const studentScholarships = await vault.getStudentScholarships(student.address);
      expect(studentScholarships.length).to.equal(1);
      expect(studentScholarships[0].encryptedDetails).to.equal(encryptedData);
      expect(studentScholarships[0].amountHash).to.equal(amountHash);
      expect(studentScholarships[0].amount).to.equal(amount);
      expect(studentScholarships[0].claimed).to.be.false;
    });
    it("Should fail if a non-owner tries to award a scholarship", async function () {
      await expect(
        vault.connect(otherUser).awardScholarship(student.address, encryptedData, amountHash, amount)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
    it("Should fail if the student is not registered", async function () {
      await expect(
        vault.awardScholarship(otherUser.address, encryptedData, amountHash, amount)
      ).to.be.revertedWith("Student public key not registered");
    });
  });
  describe("Claiming Scholarships", function () {
    const encryptedData = "encrypted-aes-payload-string";
    const amount = ethers.parseEther("500");
    let amountHash;
    beforeEach(async function () {
      amountHash = ethers.keccak256(ethers.toUtf8Bytes("500-salt"));
      const pubKey = ethers.hexlify(ethers.randomBytes(33));
      await vault.connect(student).registerPublicKey(pubKey);
      await vault.awardScholarship(student.address, encryptedData, amountHash, amount);
    });
    it("Should allow the student to claim their scholarship", async function () {
      const initialStudentBalance = await token.balanceOf(student.address);
      const initialVaultBalance = await token.balanceOf(await vault.getAddress());
      await expect(vault.connect(student).claimScholarship(0))
        .to.emit(vault, "ScholarshipClaimed")
        .withArgs(student.address, 0, amount);
      const finalStudentBalance = await token.balanceOf(student.address);
      const finalVaultBalance = await token.balanceOf(await vault.getAddress());
      expect(finalStudentBalance - initialStudentBalance).to.equal(amount);
      expect(initialVaultBalance - finalVaultBalance).to.equal(amount);
      const scholarships = await vault.getStudentScholarships(student.address);
      expect(scholarships[0].claimed).to.be.true;
    });
    it("Should fail if another user attempts to claim the scholarship", async function () {
      await expect(
        vault.connect(otherUser).claimScholarship(0)
      ).to.be.revertedWith("Scholarship does not exist");
    });
    it("Should fail if the scholarship is already claimed", async function () {
      await vault.connect(student).claimScholarship(0);
      await expect(
        vault.connect(student).claimScholarship(0)
      ).to.be.revertedWith("Scholarship already claimed");
    });
  });
  describe("Auditor Compliance & Verification", function () {
    const encryptedData = "encrypted-data";
    const amount = ethers.parseEther("200");
    let amountHash;
    beforeEach(async function () {
      amountHash = ethers.keccak256(ethers.toUtf8Bytes("200-salt"));
      const pubKey = ethers.hexlify(ethers.randomBytes(33));
      await vault.connect(student).registerPublicKey(pubKey);
      await vault.awardScholarship(student.address, encryptedData, amountHash, amount);
    });
    it("Should allow the auditor to retrieve all global scholarships", async function () {
      const records = await vault.connect(auditor).getAllScholarships();
      expect(records.length).to.equal(1);
      expect(records[0].student).to.equal(student.address);
      expect(records[0].amount).to.equal(amount);
    });
    it("Should reject non-auditor retrieval requests", async function () {
      await expect(
        vault.connect(owner).getAllScholarships()
      ).to.be.revertedWith("Caller is not the auditor");
      await expect(
        vault.connect(student).getAllScholarships()
      ).to.be.revertedWith("Caller is not the auditor");
    });
    it("Should allow owner to change auditor role (compliance management)", async function () {
      await expect(vault.connect(owner).setAuditor(otherUser.address))
        .to.emit(vault, "AuditorUpdated")
        .withArgs(auditor.address, otherUser.address);
      expect(await vault.auditor()).to.equal(otherUser.address);
      // New auditor can now fetch, old one cannot
      await expect(vault.connect(otherUser).getAllScholarships()).to.not.be.reverted;
      await expect(vault.connect(auditor).getAllScholarships()).to.be.revertedWith("Caller is not the auditor");
    });
  });
});
