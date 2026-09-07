require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const customers = [
  ["PFIZ","PFIZER AUSTRALIA PTY LTD","Pfizer Australia","50 008 422 348","INACTIVE","STANDARD","Pharmaceutical / Healthcare","NET 30","AUD"],
  ["PHYT","PHYTOLOGIC HOLDINGS PTY LIMITED","Phytologic","44 615 818 749","INACTIVE","STANDARD","Consumer Health / Supplements","NET 60","AUD"],
  ["GALD","GALDERMA AUSTRALIA PTY LTD","Galderma","12 003 976 930","ACTIVE","STANDARD","Pharmaceutical / Dermatology","NET 30","AUD"],
  ["ZOET","ZOETIS AUSTRALIA PTY LTD","Zoetis","94 156 476 425","INACTIVE","STANDARD","Animal Health / Pharmaceutical","NET 60","AUD"],
  ["FKA","FRESENIUS KABI AUSTRALIA PTY LIMITED","Fresenius Kabi","39 109 383 593","ACTIVE","STANDARD","Pharmaceutical / Healthcare","NET 60","AUD"],
  ["INOV","INOVA PHARMACEUTICALS (AUSTRALIA) PTY LIMITED","iNova Pharmaceuticals","13 617 871 539","INACTIVE","STANDARD","Pharmaceutical / Consumer Health","NET 30","AUD"],
  ["STAE","STAEDTLER (PACIFIC) PTY LTD","STAEDTLER","24 000 023 692","INACTIVE","STANDARD","Stationery / Consumer Goods","NET 45","AUD"],
  ["COLG","COLGATE-PALMOLIVE PTY LTD","Colgate-Palmolive","79 002 792 163","ACTIVE","STANDARD","FMCG / Personal Care","NET 30","AUD"],
  ["MARZ","MARZENA BODYCARE AUSTRALASIA LTD","Marzena BodyCare",null,"INACTIVE","STANDARD","Personal Care / Beauty","NET 60","AUD"],
  ["BIAH","BOEHRINGER INGELHEIM ANIMAL HEALTH AUSTRALIA PTY. LTD.","Boehringer Ingelheim Animal Health","53 071 187 285","ACTIVE","STANDARD","Animal Health / Pharmaceutical","NET 45","AUD"],
  ["IPS","INTERNATIONAL PUBLISHING SERVICES PTY LTD","International Publishing Services","33 124 976 450","INACTIVE","STANDARD","Packaging / Publishing Services","NET 30","AUD"],
  ["KCA","KIMBERLY-CLARK AUSTRALIA PTY. LIMITED","Kimberly-Clark","65 000 032 333","ACTIVE","STANDARD","FMCG / Personal Care","NET 45","AUD"],
  ["UCAN","UNIVERSAL AU PTY LTD","Universal Candy","93 090 425 764","INACTIVE","STANDARD","Confectionery / FMCG","NET 30","AUD"],
  ["PFAB","PIERRE FABRE AUSTRALIA PTY LTD","Pierre Fabre","30 098 999 850","ACTIVE","STANDARD","Pharmaceutical / Dermatology","NET 60","AUD"],
  ["KENV","JOHNSON & JOHNSON PACIFIC PTY LIMITED","Kenvue","73 001 121 446","ACTIVE","STANDARD","Consumer Health / Pharmaceutical","NET 60","AUD"],
  ["SELF","SELF CARE CORPORATION PTY LTD","SelfCare","88 132 213 113","INACTIVE","STANDARD","Personal Care / Cosmetics","NET 60","AUD"],
  ["JOHN","JOHNSTON PACKAGING PTY LIMITED","Johnston Packaging","35 001 615 845","INACTIVE","STANDARD","Packaging","NET 60","AUD"],
  ["HALE","HALEON AUSTRALIA PTY LTD","Haleon","68 603 310 292","ACTIVE","KEY_ACCOUNT","Consumer Health / Pharmaceutical","NET 90","AUD"],
  ["BIOG","BIOGAIA AUSTRALIA PTY LTD","BioGaia ANZ","52 674 500 791","ACTIVE","STANDARD","Consumer Health / Supplements","NET 30","AUD"],
  ["BOEI","BOEHRINGER INGELHEIM PTY LTD","Boehringer Ingelheim","52 000 452 308","ACTIVE","STANDARD","Pharmaceutical / Healthcare","NET 90","AUD"],
  ["UNIL","UNILEVER AUSTRALIA LIMITED","Unilever","66 004 050 828","ACTIVE","STANDARD","FMCG / Consumer Goods","NET 30","AUD"],
  ["PG","PROCTER & GAMBLE AUSTRALIA PTY. LIMITED","Procter & Gamble","91 008 396 245","ACTIVE","KEY_ACCOUNT","FMCG / Consumer Goods","NET 60","AUD"],
  ["INTP","INTERPHARMA PTY LTD","InterPharma","19 099 877 899","INACTIVE","STANDARD","Pharmaceutical / Healthcare","NET 30","AUD"],
  ["WERR","THE WERRINGA GROUP PTY LTD","The Werringa Group",null,"INACTIVE","STANDARD",null,"NET 30","AUD"],
  ["ELAN","ELANCO AUSTRALASIA PTY LTD","Elanco Animal Health","64 076 745 198","INACTIVE","STANDARD","Animal Health / Pharmaceutical","NET 60","AUD"],
  ["NINE","NINE DESIGN PTY LIMITED","Nine Design","26 133 995 838","INACTIVE","STANDARD","Design / Printing","NET 30","AUD"],
  ["LIPA","LIPA PHARMACEUTICALS LTD","Lipa Pharmaceuticals","21 070 106 526","INACTIVE","STANDARD","Pharmaceutical / Contract Manufacturing","NET 30","AUD"],
  ["NES","NESTLE AUSTRALIA LTD","Nestlé Australia","77 000 011 316","ACTIVE","STANDARD","Food / FMCG","NET 45","AUD"]
];

async function main() {
  console.log("Starting customer master import...\n");

  for (const [
    customer_code,
    legal_name,
    trading_name,
    tax_id,
    status,
    customer_type,
    industry,
    payment_terms,
    default_currency
  ] of customers) {

    const data = {
      legal_name,
      trading_name,
      tax_id,
      status,
      customer_type,
      industry,
      payment_terms,
      default_currency,
      is_active: status === "ACTIVE"
    };

    const result = await prisma.customer.upsert({
      where: { customer_code },
      update: data,
      create: {
        customer_code,
        ...data
      }
    });

    console.log(`${status === "ACTIVE" ? "ACTIVE  " : "INACTIVE"} ${result.customer_code} - ${result.trading_name}`);
  }

  console.log("\nCustomer master import completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
