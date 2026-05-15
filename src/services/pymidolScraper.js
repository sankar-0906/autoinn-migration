import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import logger from "../config/logger.config.js";

puppeteer.use(StealthPlugin());

let browser;
let sessionCookies = null;
let lastUsed = Date.now();

const PYM_USER = process.env.PYM_USER;
const PYM_PASS = process.env.PYM_PASS;

async function initBrowser() {
  if (!browser || !browser.isConnected()) {
    logger.info("Launching Pymidol Scraper browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  lastUsed = Date.now();
  return browser;
}

async function getSessionCookies() {
  if (sessionCookies) return sessionCookies;

  const b = await initBrowser();
  const page = await b.newPage();

  try {
    logger.info("Initiating Pymidol login...");
    await page.goto("https://www.pymidol.com/pymidol/login-app/auth/pre-login", {
      waitUntil: "networkidle2",
    });

    // Enter username
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', PYM_USER);
    
    // Click Sign In
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => /sign/i.test(b.innerText));
      if (btn) btn.click();
    });

    // Wait for password
    await page.waitForSelector('input[name="password"]');
    await page.type('input[name="password"]', PYM_PASS);

    // Click Sign In again
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => /sign/i.test(b.innerText));
      if (btn) btn.click();
    });

    // Wait for successful login
    await page.waitForResponse(
      (response) => response.url().includes("/spare-parts/helper/getbycdidcdkey1") && response.status() === 200,
      { timeout: 30000 }
    );

    sessionCookies = await page.cookies();
    logger.info("Pymidol login successful, cookies cached.");
    return sessionCookies;
  } catch (error) {
    logger.error("Pymidol login failed:", error);
    throw error;
  } finally {
    await page.close();
  }
}

export async function fetchMarketInfo(chassisNo) {
  try {
    const cookies = await getSessionCookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const userData = {
      userId: "Y2966",
      userName: "Y2966",
      companyCode: "IYM",
      loginUserType: "030",
      overseasDealerFlag: false,
      pymidolDealerCd: "757.00",
      propacDealerCd: "75700",
      levelId: 0,
      dealerNm: "PACER MOTORS PVT. LTD.",
      departmentId: 5,
      role: "12",
      networkLocation: "Devanhalli",
      networkType: "030",
      networkCd: "KA 75700 - Y 2966",
      networkNm: "Nandi Bikes Pvt Ltd",
      userType: "1",
      isYbcGstSame: null,
      networkCdSales: "KA 75700 - Y 2966",
    };

    // API Call 1: MIT0102
    const mitResponse = await fetch("https://www.pymidol.com/spare-parts/mit0102/retrieve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieString,
        Referer: "https://www.pymidol.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        user: { ...userData, dataSecurityModel: { dealerList: null } },
        dealerCd: null,
        chassisNo,
        customerCd: null,
        claimNo: null,
      }),
    });

    if (!mitResponse.ok) throw new Error(`MIT0102 failed: ${mitResponse.status}`);
    const mitData = await mitResponse.json();

    // API Call 2: SVT0103 for color
    if (mitData.data?.mit0102RequestModel) {
      const customerData = mitData.data.mit0102RequestModel;
      const sysDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      const svtResponse = await fetch("https://www.pymidol.com/spare-parts/svt0103/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieString,
          Referer: "https://www.pymidol.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({
          user: userData,
          customerIdHdr: null,
          chassisNoHdr: chassisNo,
          customerId: customerData.customerId || null,
          customerNm: customerData.customerNm || null,
          chassisNo,
          modelCd: customerData.modelCd || null,
          modelNm: customerData.modelNm || null,
          color: customerData.color || null,
          retailDate: customerData.retailDate || null,
          city: customerData.city || null,
          emailId: customerData.emailId || " ",
          address: customerData.address || null,
          ppBookType: customerData.ppBookType || null,
          ppBookNo: customerData.ppBookNo || null,
          ppExpiryDate: customerData.ppExpiryDate || null,
          ppSaleDate: customerData.ppSaleDate || null,
          serviceNo: "",
          currentServiceDueKms: 0,
          currentServiceDueDate: " ",
          serviceType: "010",
          nextServiceDueKms: 0,
          nextServiceDueDate: " ",
          actualKms: "",
          actualKmsInt: null,
          couponNo: "",
          serviceDate: "",
          dealerCheckflg: null,
          mobileNo: "",
          jobCardNo: null,
          endReceivedDateForHardCopy: null,
          dealerCd: "757.00",
          dealerNm: "",
          chkInDate: null,
          chkOutDate: null,
          chkInTime: null,
          chkOutTime: null,
          serviceTypeI3S: null,
          totalTimeTaken: null,
          rseType: null,
          mechanicType: null,
          outletType: "030",
          branchSubDealerCd: "KA 75700 - Y 2966",
          branchSubDealerNm: "Nandi Bikes Pvt Ltd",
          registrationNo: null,
          reasonForDelay: null,
          otherContactNo: null,
          remarks: null,
          sysDate,
          specCd: customerData.specCd || null,
          dealerI3S: "0",
          rseDesignationCd: "025",
          mechineDesignationCd: "027",
          dealerHidden: "757.00",
          operationBlockingExist: false,
          loginUserAdmin: false,
          designHidden: "1",
          design1Hidden: "2",
          dealerFlg: "1",
          dealerStaffCd: null,
          dealerStaffNm: null,
          dealerStaffMobile: null,
          dealerCdHidden: "757.00",
          plantCd: customerData.plantCd || null,
          loginUserType: "030",
          isAmcEligible: "FALSE",
          isAmcService: "0",
          amcNo: null,
          isDealer: "2",
        }),
      });

      if (svtResponse.ok) {
        const svtData = await svtResponse.json();
        if (svtData.data?.svt0103RequestModel?.color) {
          mitData.color = svtData.data.svt0103RequestModel.color;
        }
      }
    }

    return mitData;
  } catch (error) {
    logger.error("Fetch market info error:", error);
    if (error.message.includes("401") || error.message.includes("403")) {
      sessionCookies = null;
    }
    throw error;
  }
}

// Auto-close idle browser
setInterval(async () => {
  if (browser && Date.now() - lastUsed > 5 * 60 * 1000) {
    await browser.close();
    browser = null;
    sessionCookies = null;
    logger.info("Pymidol browser auto-closed due to idle timeout.");
  }
}, 60000);
