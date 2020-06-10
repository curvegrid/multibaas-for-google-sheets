// Copyright (c) 2020 Curvegrid Inc.

/**
 * Concat logs to return to API call
 */
let log = '';
function loggerAPI(msg) {
  if (msg) {
    log += `${msg}\n`;
  }
  return log;
}

/**
 * Init test with GasT to run tests on Apps Script
 *
 * @param {switchLogger} Switch logger for between GCP and API call
 */
function initTest(customLogger) {
  // GasT Initialization.
  if ((typeof GasTap) === 'undefined') {
    // eslint-disable-next-line no-eval
    eval(UrlFetchApp.fetch('https://raw.githubusercontent.com/zixia/gast/master/src/gas-tap-lib.js').getContentText());
  }

  if (typeof customLogger !== 'function') {
    // For logging test results on GCP
    return new GasTap();
  }

  // For responding test results to API call
  return new GasTap({
    logger: loggerAPI,
  });
}

/**
 * Run test
 * @param {test} GasT object
 * @param {config} Config object
 * `param {testCase} Test contents object
 */
function run(test, config, testCase) {
  test(testCase.name, (t) => {
    if (testCase.skip) {
      return;
    }

    const output = testCase.func(config.deployment, config.apiKey, ...testCase.args);
    const numRow = output.length;
    const numCol = output[0].length;

    // Write on test sheet
    config.sheet.clearContents();
    config.sheet.getRange(1, 1, numRow, numCol).setValues(output);
    SpreadsheetApp.flush();

    const actualSheet = config.sheet.getRange(1, 1, numRow, numCol).getValues();
    // loggerAPI(`BOTH VALUES:
    //   ${JSON.stringify(actualSheet)}, ${JSON.stringify(testCase.expected)}`);
    t.deepEqual(actualSheet, testCase.expected, 'data in the sheet should be same');

    config.sheet.clearContents();
  });
}

/**
 * Called from outside to run tests and return test results
 */
// eslint-disable-next-line no-unused-vars
function testRunner() {
  const test = initTest(loggerAPI);
  const testSheetURL = 'https://docs.google.com/spreadsheets/d/12jQjyXkqUooDK5wlDyazBa3xZb5NVa-YyixNtTRZIsI/edit#gid=0';
  const ss = SpreadsheetApp.openByUrl(testSheetURL);
  SpreadsheetApp.setActiveSpreadsheet(ss);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const config = {
    deployment: sheet.getRange('B1').getValue(),
    apiKey: sheet.getRange('B2').getValue(),
    sheet: SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Test'),
  };
  const testCases = [
    {
      name: 'TestMBADDRESS',
      skip: false,
      only: false,
      func: MBADDRESS,
      args: ['0x0000000000000012340000000000000000000000'],
      expected: [
        ['label', 'address', 'balance', 'chain', 'isContract', 'modules', 'contracts'],
        ['', '0x0000000000000012340000000000000000000000', '0', 'ethereum', 'false', '', ''],
      ],
    },
    {
      name: 'TestMBBLOCK',
      skip: false,
      only: false,
      func: MBBLOCK,
      args: [1],
      expected: [
        [
          'blockchain',
          'hash',
          'difficulty',
          'gasLimit',
          'number',
          'timestamp',
          'receipt',
          'txHashes',
        ],
        [
          'ethereum',
          '0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6',
          17171480576,
          5000,
          1,
          // eslint-disable-next-line no-undef
          formatDateTime('2015-07-30T15:26:28.000Z'),
          '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
          '',
        ],
      ],
    },
    {
      // TODO: fix error
      name: 'TestMBCOMPOSE',
      skip: true,
      only: false,
      func: MBCOMPOSE,
      args: [],
      expected: {
        from: '0xfa49187F19edeEb7df7868Db82F2D723440B6C6E', to: '0x775E90a06A3D908940eC326924262b37943Aa140', value: '0', gas: 78572, gasPrice: '18200000000', data: '0xd32bfb6c00000000000000000000000000000000000000000000000000000000000000ec', nonce: 11, hash: '0xf662f76728c8e6cbaa011a189b87f43236f0884653635158dc6a47cc7fcf3c6e',
      },
    },
    {
      // TODO: fill out
      name: 'TestMBCUSTOMQUERY',
      skip: true,
      only: false,
      func: MBCUSTOMQUERY,
      args: [],
      expected: [],
    },
    {
      // TODO: fill out
      name: 'TestMBCUSTOMQUERYTEMPLATE',
      skip: true,
      only: false,
      func: MBCUSTOMQUERYTEMPLATE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBEVENTLIST',
      skip: false,
      only: false,
      func: MBEVENTLIST,
      args: ['publiclock'],
      expected: [
        ['event', 'description', 'inputs'], ['Approval', '', '3 inputs:\nowner address\napproved address\ntokenId uint256'],
        ['ApprovalForAll', '', '3 inputs:\nowner address\noperator address\napproved bool'], ['CancelKey', '', '4 inputs:\ntokenId uint256\nowner address\nsendTo address\nrefund uint256'], ['Disable', '', 'no inputs'], ['ExpirationChanged', '', '3 inputs:\n_tokenId uint256\n_amount uint256\n_timeAdded bool'], ['ExpireKey', '', '1 input:\ntokenId uint256'], ['KeyGranterAdded', '', '1 input:\naccount address'], ['KeyGranterRemoved', '', '1 input:\naccount address'], ['KeyManagerChanged', '', '2 inputs:\n_tokenId uint256\n_newManager address'], ['LockManagerAdded', '', '1 input:\naccount address'], ['LockManagerRemoved', '', '1 input:\naccount address'], ['NewLockSymbol', '', '1 input:\nsymbol string'], ['NonceChanged', '', '2 inputs:\nkeyManager address\nnextAvailableNonce uint256'], ['PricingChanged', '', '4 inputs:\noldKeyPrice uint256\nkeyPrice uint256\noldTokenAddress address\ntokenAddress address'], ['RefundPenaltyChanged', '', '2 inputs:\nfreeTrialLength uint256\nrefundPenaltyBasisPoints uint256'], ['RenewKeyPurchase', '', '2 inputs:\nowner address\nnewExpiration uint256'], ['Transfer', '', '3 inputs:\nfrom address\nto address\ntokenId uint256'], ['TransferFeeChanged', '', '1 input:\ntransferFeeBasisPoints uint256'], ['Withdrawal', '', '4 inputs:\nsender address\ntokenAddress address\nbeneficiary address\namount uint256'],
      ],
    },
    {
      // TODO: fill out
      name: 'TestMBEVENTS',
      skip: true,
      only: false,
      func: MBEVENTS,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBFUNCTIONLIST',
      skip: false,
      only: false,
      func: MBFUNCTIONLIST,
      args: ['erc20interface'],
      expected: [
        ['function', 'description', 'read/write', 'inputs', 'outputs'], ['allowance', '', 'read', '2 inputs:\ntokenOwner address\nspender address', '1 output:\nremaining uint256'], ['approve', '', 'write', '2 inputs:\nspender address\ntokens uint256', '1 output:\nsuccess bool'], ['balanceOf', '', 'read', '1 input:\ntokenOwner address', '1 output:\nbalance uint256'], ['decimals', '', 'read', 'no inputs', '1 output:\nuint8'], ['name', '', 'read', 'no inputs', '1 output:\nstring'], ['symbol', '', 'read', 'no inputs', '1 output:\nstring'], ['totalSupply', '', 'read', 'no inputs', '1 output:\nuint256'], ['transfer', '', 'write', '2 inputs:\nto address\ntokens uint256', '1 output:\nsuccess bool'],
        ['transferFrom', '', 'write', '3 inputs:\nfrom address\nto address\ntokens uint256', '1 output:\nsuccess bool'],
      ],
    },
    {
      // TODO: fill out
      name: 'TestMBGET',
      skip: true,
      only: false,
      func: MBGET,
      args: [],
      expected: [],
    },
    {
      // TODO: fill out
      name: 'TestMBPOSTTEMPLATE',
      skip: true,
      only: false,
      func: MBPOSTTEMPLATE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBQUERY',
      skip: false,
      only: false,
      func: MBQUERY,
      args: ['Queued Exits', 5],
      expected: [
        ['exitid', 'priority'],
        ['666629079848833945283516969712032889240528132', '41733475565687827013448321883143303337820997464902624318864041623172916484'],
        ['1401973687505857731830456287637471880977785047', '41751861880721805686398941946704262444111373862207383147640349032816517335'],
        ['2054345912177215402617314954546801559724193123', '41752026299537173367456859727492207583157445734862728631688173641164748131'],
        ['12018136374180221520320355170630020014075267311', '41753870186123925948850253652650103648140958609936382295744042661855611119'],
        ['1805958224368381604189476822833232573913333196', '41755646356907136232573277651225957746239350543415473449459681295463054796'],
      ],
    },
    {
      // TODO: fix error
      name: 'TestMBTX',
      skip: false,
      only: false,
      func: MBTX,
      args: ['0xf2dc2d5a7d758e8fc3170e407e7a4e7b86b89b02fc945191d403e4a78486e813'],
      expected: [
        [
          'isPending',
          'nonce',
          'gasPrice',
          'gas',
          'to',
          'value',
          'input',
          'v',
          'r',
          's',
          'hash',
        ],
        [
          'false',
          0,
          30000000000,
          100000,
          '0xea610b1153477720748dc13ed378003941d84fab',
          0,
          '0xa9059cbb000000000000000000000000075f7ffe1465e037fc8d1349018f87dad05d867500000000000000000000000000000000000000000000004de6618e729c540000',
          '0x25',
          '0x22e60119bbc06020571758c01f1cbdd2c4031bd490a98c2c4bf00cb19d4b5dcb',
          '0x5b4b3170f4268a5ec86cbe2ca5fef2b0854af4a9c1aa85343b6be12ebd9b5839',
          '0xf2dc2d5a7d758e8fc3170e407e7a4e7b86b89b02fc945191d403e4a78486e813',
        ],
      ],
    },
  ];

  // TODO: cover internal functions
  // https://github.com/curvegrid/hackathon-sunset-supreme/issues/5

  let testCasesFiltered = testCases.filter((testCase) => testCase.only);
  if (testCasesFiltered.length < 1) {
    testCasesFiltered = testCases;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const testCase of testCasesFiltered) {
    run(test, config, testCase);
  }

  test.finish();

  return { failures: test.totalFailed(), log: loggerAPI() };
}
