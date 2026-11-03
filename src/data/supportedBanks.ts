import { BankInstitution, RecipientVerificationResponse } from '../types/banking';

export const SUPPORTED_BANKS: BankInstitution[] = [
  // United States Institutions
  {
    id: 'aurelith',
    name: 'Aurelith Reserve',
    shortName: 'Aurelith Reserve',
    routingNumber: '111301122',
    swiftCode: 'AURUS33D',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Internal Real-Time Book Transfer', 'Fedwire', 'FedACH'],
  },
  {
    id: 'chase',
    name: 'JPMorgan Chase Bank, N.A.',
    shortName: 'Chase Bank',
    routingNumber: '111000614',
    swiftCode: 'CHASUS33',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH', 'Real-Time Payments (RTP)'],
  },
  {
    id: 'bofa',
    name: 'Bank of America, N.A.',
    shortName: 'Bank of America',
    routingNumber: '111000025',
    swiftCode: 'BOFAUS3N',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH', 'Real-Time Payments (RTP)'],
  },
  {
    id: 'wells_fargo',
    name: 'Wells Fargo Bank, N.A.',
    shortName: 'Wells Fargo',
    routingNumber: '111900659',
    swiftCode: 'WFBIUS6S',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH'],
  },
  {
    id: 'citibank',
    name: 'Citibank, N.A.',
    shortName: 'Citibank',
    routingNumber: '021000089',
    swiftCode: 'CITIUS33',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH', 'SWIFT International'],
  },
  {
    id: 'pnc',
    name: 'PNC Bank, N.A.',
    shortName: 'PNC Bank',
    routingNumber: '043000096',
    swiftCode: 'PNCBUS33',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH'],
  },
  {
    id: 'capital_one',
    name: 'Capital One, N.A.',
    shortName: 'Capital One',
    routingNumber: '051405515',
    swiftCode: 'HIBKUS44',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH'],
  },
  {
    id: 'us_bank',
    name: 'U.S. Bank National Association',
    shortName: 'U.S. Bank',
    routingNumber: '091000022',
    swiftCode: 'USBKUS44',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH'],
  },
  {
    id: 'truist',
    name: 'Truist Bank',
    shortName: 'Truist',
    routingNumber: '061000104',
    swiftCode: 'SNTRUS3A',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH'],
  },
  {
    id: 'goldman_sachs',
    name: 'Goldman Sachs Bank USA',
    shortName: 'Goldman Sachs Bank',
    routingNumber: '121144994',
    swiftCode: 'GSNYUS33',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH', 'Private Client Clearing'],
  },
  {
    id: 'morgan_stanley',
    name: 'Morgan Stanley Private Bank, N.A.',
    shortName: 'Morgan Stanley Bank',
    routingNumber: '026013576',
    swiftCode: 'MSNYUS33',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH'],
  },
  {
    id: 'bny_mellon',
    name: 'The Bank of New York Mellon',
    shortName: 'BNY Mellon',
    routingNumber: '021000018',
    swiftCode: 'IRVTUS3N',
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    supportedRails: ['Fedwire', 'FedACH', 'SWIFT Custody'],
  },

  // United Kingdom Institutions
  {
    id: 'barclays_uk',
    name: 'Barclays Bank UK PLC',
    shortName: 'Barclays Bank',
    routingNumber: '20-00-00',
    swiftCode: 'BARCGB22',
    country: 'United Kingdom',
    countryCode: 'GB',
    currency: 'GBP',
    supportedRails: ['CHAPS', 'Faster Payments', 'SWIFT International'],
  },
  {
    id: 'hsbc_uk',
    name: 'HSBC UK Bank plc',
    shortName: 'HSBC Bank',
    routingNumber: '40-05-15',
    swiftCode: 'HBUKGB41',
    country: 'United Kingdom',
    countryCode: 'GB',
    currency: 'GBP',
    supportedRails: ['CHAPS', 'Faster Payments', 'SWIFT International'],
  },
  {
    id: 'lloyds_uk',
    name: 'Lloyds Bank plc',
    shortName: 'Lloyds Bank',
    routingNumber: '30-90-89',
    swiftCode: 'LOYDGB2L',
    country: 'United Kingdom',
    countryCode: 'GB',
    currency: 'GBP',
    supportedRails: ['CHAPS', 'Faster Payments'],
  },

  // Canada Institutions
  {
    id: 'rbc_canada',
    name: 'Royal Bank of Canada',
    shortName: 'RBC Royal Bank',
    routingNumber: '00002-003',
    swiftCode: 'ROYCCAT2',
    country: 'Canada',
    countryCode: 'CA',
    currency: 'CAD',
    supportedRails: ['Lynx', 'ACSS', 'SWIFT International'],
  },
  {
    id: 'td_canada',
    name: 'Toronto-Dominion Bank',
    shortName: 'TD Canada Trust',
    routingNumber: '00004-004',
    swiftCode: 'TDOMCATT',
    country: 'Canada',
    countryCode: 'CA',
    currency: 'CAD',
    supportedRails: ['Lynx', 'ACSS', 'SWIFT International'],
  },

  // Switzerland & Europe Institutions
  {
    id: 'ubs_swiss',
    name: 'UBS Switzerland AG',
    shortName: 'UBS Bank',
    routingNumber: '00230',
    swiftCode: 'UBSWCHZH',
    country: 'Switzerland',
    countryCode: 'CH',
    currency: 'CHF',
    supportedRails: ['SIC', 'SEPA', 'SWIFT International'],
  },
  {
    id: 'deutsche_bank',
    name: 'Deutsche Bank AG',
    shortName: 'Deutsche Bank',
    routingNumber: '50070010',
    swiftCode: 'DEUTDEDD',
    country: 'Germany',
    countryCode: 'DE',
    currency: 'EUR',
    supportedRails: ['SEPA Instant', 'TARGET2', 'SWIFT International'],
  },
  {
    id: 'bnp_paribas',
    name: 'BNP Paribas S.A.',
    shortName: 'BNP Paribas',
    routingNumber: '30004',
    swiftCode: 'BNPAFRPP',
    country: 'France',
    countryCode: 'FR',
    currency: 'EUR',
    supportedRails: ['SEPA Instant', 'TARGET2', 'SWIFT International'],
  },

  // Asia-Pacific & Middle East
  {
    id: 'dbs_singapore',
    name: 'DBS Bank Ltd',
    shortName: 'DBS Bank',
    routingNumber: '7171-001',
    swiftCode: 'DBSSSGSG',
    country: 'Singapore',
    countryCode: 'SG',
    currency: 'SGD',
    supportedRails: ['FAST', 'MEPS+', 'SWIFT International'],
  },
  {
    id: 'emirates_nbd',
    name: 'Emirates NBD Bank PJSC',
    shortName: 'Emirates NBD',
    routingNumber: '026',
    swiftCode: 'EBILAEAD',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    currency: 'AED',
    supportedRails: ['UAEFTS', 'IPI', 'SWIFT International'],
  },
  {
    id: 'commbank_au',
    name: 'Commonwealth Bank of Australia',
    shortName: 'Commonwealth Bank',
    routingNumber: '062-000',
    swiftCode: 'CTBAAU2S',
    country: 'Australia',
    countryCode: 'AU',
    currency: 'AUD',
    supportedRails: ['NPP / Osko', 'BECS', 'SWIFT International'],
  },
];

export const KNOWN_VERIFIED_RECIPIENTS: Record<string, { recipientName: string; bankName: string; routingNumber: string; swiftCode: string; accountType: string }> = {
  // JPMorgan Chase Bank
  '9843210091': {
    recipientName: 'Lone Star Energy & Utilities LLC',
    bankName: 'JPMorgan Chase Bank, N.A.',
    routingNumber: '111000614',
    swiftCode: 'CHASUS33',
    accountType: 'Corporate Commercial Checking',
  },
  '4829104820': {
    recipientName: 'Marcus Vance',
    bankName: 'JPMorgan Chase Bank, N.A.',
    routingNumber: '111000614',
    swiftCode: 'CHASUS33',
    accountType: 'Personal Premier Checking',
  },
  '2048192048': {
    recipientName: 'Highland Park Holdings Ltd',
    bankName: 'JPMorgan Chase Bank, N.A.',
    routingNumber: '111000614',
    swiftCode: 'CHASUS33',
    accountType: 'Private Wealth Management Account',
  },

  // Bank of America
  '3820194021': {
    recipientName: 'Sarah Jenkins',
    bankName: 'Bank of America, N.A.',
    routingNumber: '111000025',
    swiftCode: 'BOFAUS3N',
    accountType: 'Advantage Banking Checking',
  },
  '5920194820': {
    recipientName: 'Dallas Metro Logistics Inc',
    bankName: 'Bank of America, N.A.',
    routingNumber: '111000025',
    swiftCode: 'BOFAUS3N',
    accountType: 'Commercial Treasury Operating Account',
  },
  '1928401928': {
    recipientName: 'Robert E. Montgomery',
    bankName: 'Bank of America, N.A.',
    routingNumber: '111000025',
    swiftCode: 'BOFAUS3N',
    accountType: 'Private Client Account',
  },

  // Wells Fargo
  '6019284019': {
    recipientName: 'Elena Rostova',
    bankName: 'Wells Fargo Bank, N.A.',
    routingNumber: '111900659',
    swiftCode: 'WFBIUS6S',
    accountType: 'Prime Checking Account',
  },
  '7829104928': {
    recipientName: 'Preston Hollow Family Trust',
    bankName: 'Wells Fargo Bank, N.A.',
    routingNumber: '111900659',
    swiftCode: 'WFBIUS6S',
    accountType: 'Fiduciary & Estate Account',
  },
  '3910294819': {
    recipientName: 'Summit Ridge Properties LLC',
    bankName: 'Wells Fargo Bank, N.A.',
    routingNumber: '111900659',
    swiftCode: 'WFBIUS6S',
    accountType: 'Commercial Real Estate Escrow',
  },

  // Citibank
  '8492019482': {
    recipientName: 'David K. Sterling',
    bankName: 'Citibank, N.A.',
    routingNumber: '021000089',
    swiftCode: 'CITIUS33',
    accountType: 'Citi Priority Checking',
  },
  '1948201948': {
    recipientName: 'Continental Export Corp',
    bankName: 'Citibank, N.A.',
    routingNumber: '021000089',
    swiftCode: 'CITIUS33',
    accountType: 'International Trade Operating Account',
  },

  // PNC Bank
  '5520194821': {
    recipientName: 'Apex Real Estate Acquisitions',
    bankName: 'PNC Bank, N.A.',
    routingNumber: '043000096',
    swiftCode: 'PNCBUS33',
    accountType: 'Commercial Operating Account',
  },

  // Capital One
  '7192048192': {
    recipientName: 'Chloe Bennett',
    bankName: 'Capital One, N.A.',
    routingNumber: '051405515',
    swiftCode: 'HIBKUS44',
    accountType: '360 Checking Account',
  },

  // U.S. Bank
  '8819204819': {
    recipientName: 'Jordan Taylor',
    bankName: 'U.S. Bank National Association',
    routingNumber: '091000022',
    swiftCode: 'USBKUS44',
    accountType: 'Bank Smartly Checking',
  },

  // Truist
  '4910294810': {
    recipientName: 'Austin Tech Ventures LLC',
    bankName: 'Truist Bank',
    routingNumber: '061000104',
    swiftCode: 'SNTRUS3A',
    accountType: 'Commercial Checking',
  },

  // Goldman Sachs Bank
  '9281049281': {
    recipientName: 'Horizon Global Capital Partners',
    bankName: 'Goldman Sachs Bank USA',
    routingNumber: '121144994',
    swiftCode: 'GSNYUS33',
    accountType: 'Private Wealth Prime Custody',
  },

  // Morgan Stanley
  '3049182049': {
    recipientName: 'Victoria Hamilton-Cross',
    bankName: 'Morgan Stanley Private Bank, N.A.',
    routingNumber: '026013576',
    swiftCode: 'MSNYUS33',
    accountType: 'Private Client Reserve',
  },

  // Barclays Bank UK
  '40192841': {
    recipientName: 'Alistair Sterling',
    bankName: 'Barclays Bank UK PLC',
    routingNumber: '20-00-00',
    swiftCode: 'BARCGB22',
    accountType: 'Barclays Premier Current Account',
  },

  // HSBC UK
  '81920482': {
    recipientName: 'Evelyn St. Claire',
    bankName: 'HSBC UK Bank plc',
    routingNumber: '40-05-15',
    swiftCode: 'HBUKGB41',
    accountType: 'HSBC Premier Account',
  },

  // Royal Bank of Canada
  '102948102': {
    recipientName: 'Kensington Northern Advisory Corp',
    bankName: 'Royal Bank of Canada',
    routingNumber: '00002-003',
    swiftCode: 'ROYCCAT2',
    accountType: 'RBC Commercial Operating Account',
  },

  // UBS Switzerland
  '9204810293': {
    recipientName: 'Geneva Asset Management SA',
    bankName: 'UBS Switzerland AG',
    routingNumber: '00230',
    swiftCode: 'UBSWCHZH',
    accountType: 'International Wealth Reserve',
  },

  // Deutsche Bank
  '5029104920': {
    recipientName: 'Klaus Lindemann',
    bankName: 'Deutsche Bank AG',
    routingNumber: '50070010',
    swiftCode: 'DEUTDEDD',
    accountType: 'Private Banking Girokonto',
  },

  // DBS Bank Singapore
  '0039102948': {
    recipientName: 'Pacific Maritime Logistics Pte Ltd',
    bankName: 'DBS Bank Ltd',
    routingNumber: '7171-001',
    swiftCode: 'DBSSSGSG',
    accountType: 'Corporate Treasury Account',
  },

  // Emirates NBD
  '1019284019': {
    recipientName: 'Sheikh Tariq Al-Mansoor',
    bankName: 'Emirates NBD Bank PJSC',
    routingNumber: '026',
    swiftCode: 'EBILAEAD',
    accountType: 'Priority Banking Wealth Account',
  },

  // Aurelith Reserve Clients
  '1100609230': {
    recipientName: 'Aurelith Reserve Concierge Vault',
    bankName: 'Aurelith Reserve',
    routingNumber: '111301122',
    swiftCode: 'AURUS33D',
    accountType: 'Aurelith Premier Checking',
  },
  '1029384756': {
    recipientName: 'Aurelith Primary Account Holder',
    bankName: 'Aurelith Reserve',
    routingNumber: '111301122',
    swiftCode: 'AURUS33D',
    accountType: 'Aurelith Premier Checking',
  },
};
