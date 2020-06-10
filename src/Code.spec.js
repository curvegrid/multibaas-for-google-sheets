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
    const numRow = Array.isArray(output) ? output.length : 0;
    const numCol = numRow > 0 ? output[0].length : 0;

    if (testCase.debug) {
      loggerAPI(`OUTPUT: ${output}`);
      loggerAPI(`OUTPUT ROW, COL: ${numRow}, ${numCol}`);
    }

    // Write on test sheet
    config.sheet.clearContents();
    if (numRow > 0 && numCol > 0) {
      config.sheet.getRange(1, 1, numRow, numCol).setValues(output);
    } else {
      config.sheet.getRange(1, 1).setValue(output);
    }
    SpreadsheetApp.flush();

    let actualSheet;
    if (numRow > 0 && numCol > 0) {
      actualSheet = config.sheet.getRange(1, 1, numRow, numCol).getValues();
    } else {
      actualSheet = config.sheet.getRange(1, 1).getValue();
    }

    if (testCase.debug) {
      loggerAPI(`Actual Values: ${JSON.stringify(actualSheet)}`);
      loggerAPI(`Expected Values: ${JSON.stringify(testCase.expected)}`);
    }

    t.deepEqual(actualSheet, testCase.expected, 'data in the sheet should be same');

    // Keep final data in the spreadsheet
    if (!testCase.debug) {
      config.sheet.clearContents();
    }
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
      debug: false,
      func: MBADDRESS,
      args: ['0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7', '', false],
      expected: [
        [
          'label',
          'address',
          'balance',
          'chain',
          'isContract',
          'modules',
          'contracts',
        ],
        [
          'privatefaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          0,
          'ethereum',
          true,
          '',
          'multibaasfaucet 1.0',
        ],
      ],
    },
    {
      name: 'TestMBBLOCK',
      skip: false,
      only: false,
      debug: false,
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
          '0x91b8583852f0244b4c4969bef7c456898fa16d0dde5e328e4c6c0e2c086136bf',
          2,
          9990236,
          1,
          formatDateTime('2020-05-20T08:38:13.000Z'),
          '0x056b23fbba480696b65fe5a59b8f2148a1299103c4f57df839233af2cf4ca2d2',
          '0x9157a6ce0112ed417e3bda098af4fe63afbfa8af769debba3534ee24891a2050',
        ],
      ],
    },
    {
      name: 'TestMBCOMPOSE',
      skip: false,
      only: false,
      debug: false,
      func: MBCOMPOSE,
      args: [
        'multibaasfaucet',
        'multibaasfaucet',
        'deposit',
        '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
        '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
        '100000000000000000',
      ],
      expected: JSON.stringify({
        from: '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
        to: '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e',
        value: '100000000000000000',
        gas: 22774,
        gasPrice: '20000000000',
        data: '0xd0e30db0',
        nonce: 2,
        hash: '0xcc4450ebca9db6bef6dba18731c438d914246fd75a536a6a7fb9f77c0d6beb6f',
      }),
    },
    {
      // TODO: fill out
      name: 'TestMBCUSTOMQUERY',
      skip: true,
      only: false,
      debug: false,
      func: MBCUSTOMQUERY,
      args: [],
      expected: [],
    },
    {
      // TODO: fill out
      name: 'TestMBCUSTOMQUERYTEMPLATE',
      skip: true,
      only: false,
      debug: false,
      func: MBCUSTOMQUERYTEMPLATE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBEVENTLIST',
      skip: true,
      only: false,
      debug: false,
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
      debug: false,
      func: MBEVENTS,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBFUNCTIONLIST',
      skip: false,
      only: false,
      debug: false,
      func: MBFUNCTIONLIST,
      args: ['erc20interface'],
      expected: [
        ['function', 'description', 'read/write', 'inputs', 'outputs'],
        ['allowance', '', 'read', '2 inputs:\ntokenOwner address\nspender address', '1 output:\nremaining uint256'],
        ['approve', '', 'write', '2 inputs:\nspender address\ntokens uint256', '1 output:\nsuccess bool'],
        ['balanceOf', '', 'read', '1 input:\ntokenOwner address', '1 output:\nbalance uint256'],
        ['decimals', '', 'read', 'no inputs', '1 output:\nuint8'],
        ['name', '', 'read', 'no inputs', '1 output:\nstring'],
        ['symbol', '', 'read', 'no inputs', '1 output:\nstring'],
        ['totalSupply', '', 'read', 'no inputs', '1 output:\nuint256'],
        ['transfer', '', 'write', '2 inputs:\nto address\ntokens uint256', '1 output:\nsuccess bool'],
        ['transferFrom', '', 'write', '3 inputs:\nfrom address\nto address\ntokens uint256', '1 output:\nsuccess bool'],
      ],
    },
    {
      // TODO: fill out
      name: 'TestMBGET',
      skip: true,
      only: false,
      debug: false,
      func: MBGET,
      args: [],
      expected: [],
    },
    {
      // TODO: fill out
      name: 'TestMBPOSTTEMPLATE',
      skip: true,
      only: false,
      debug: false,
      func: MBPOSTTEMPLATE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBQUERY',
      skip: true,
      only: false,
      debug: false,
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
      name: 'TestMBTX',
      skip: true,
      only: false,
      debug: false,
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
          false,
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
