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

    let output;
    if (!testCase.isTemplate) {
      output = testCase.func(config.deployment, config.apiKey, ...testCase.args);
    } else {
      output = testCase.func(...testCase.args);
    }

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
      isTemplate: false,
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
          2000000000000000000,
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
      isTemplate: false,
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
      isTemplate: false,
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
        nonce: 6,
        hash: '0x72f0a63bc24503d1b71e93729c7787891633aa192dadb999f87b0f343a8ecbf4',
      }),
    },
    {
      // TODO: TOMORROW after enabling feature
      name: 'TestMBCUSTOMQUERY',
      skip: true,
      only: true,
      debug: true,
      func: MBCUSTOMQUERY,
      isTemplate: false,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBCUSTOMQUERYTEMPLATE',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERYTEMPLATE,
      isTemplate: true,
      args: [2, 2],
      expected: [['eventName', 'alias', 'index', 'aggregator', 'alias', 'index', 'aggregator', 'rule', 'operator', 'value', 'rule', 'operator', 'value']],
    },
    {
      name: 'TestMBEVENTLIST',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTLIST,
      isTemplate: false,
      args: ['multibaasfaucet'],
      expected: [
        ['event', 'description', 'inputs'],
        ['LogCurrentOperatorRevoked', '', '2 inputs:\nowner address\noperatorRevoked address'],
        ['LogDeposited', '', '2 inputs:\nsender address\namount uint256'],
        ['LogOperatorCandidateAccepted', '', '1 input:\ncandidateAccepted address'],
        ['LogOperatorCandidateRequested', '', '2 inputs:\nowner address\ncandidate address'],
        ['LogOperatorCandidateRevoked', '', '1 input:\ncandidateRevoked address'],
        ['LogOwnerCandidateAccepted', '', '1 input:\ncandidateAccepted address'],
        ['LogOwnerCandidateRequested', '', '2 inputs:\nowner address\ncandidate address'],
        ['LogOwnerCandidateRevoked', '', '1 input:\ncandidateRevoked address'],
        ['LogPaused', '', '1 input:\nowner address'],
        ['LogSent', '', '2 inputs:\nreceiver address\namount uint256'],
        ['LogUnpaused', '', '1 input:\nowner address'],
        ['LogWithdrew', '', '2 inputs:\nowner address\namount uint256'],
      ],
    },
    {
      name: 'TestMBEVENTS',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTS,
      isTemplate: false,
      args: ['privatefaucet', 1, 2],
      expected: [
        [
          'triggeredAt',
          'eventName',
          'eventDef',
          'eventInput0',
          'eventInput1',
          'eventIndexInLog',
          'eventContractAddressLabel',
          'eventContractAddress',
          'eventContractName',
          'txFrom',
          'txData',
          'txHash',
          'txIndexInBlock',
          'txBlockHash',
          'txBlockNumber',
          'txContractAddressLabel',
          'txContractAddress',
          'txContractName',
          'fxnName',
          'fxnDef',
        ],
        [
          formatDateTime('2020-06-19T08:48:36.000Z'),
          'LogDeposited',
          'LogDeposited(address sender,uint256) amount',
          '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
          1000000000000000000,
          formatDateTime('1899-12-29T15:00:00.000Z'),
          'multibaasfaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          'MultiBaasFaucet',
          '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
          '0xd0e30db0',
          '0x937f1d11da26d7350e66691bd1e8669961d3cb4727978fd6213265b504174fbf',
          0,
          '0x611df11ac2d2e8a2da1e305817f1342bed60667c7d1a7292f6da09e7f4a1cc66',
          149,
          'multibaasfaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          'MultiBaasFaucet',
          'deposit',
          'deposit()',
        ],
      ],
    },
    {
      name: 'TestMBFUNCTIONLIST',
      skip: false,
      only: false,
      debug: false,
      func: MBFUNCTIONLIST,
      isTemplate: false,
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
      name: 'TestMBGET',
      skip: false,
      only: false,
      debug: false,
      func: MBGET,
      isTemplate: false,
      args: ['privatefaucet', 'multibaasfaucet', 'getOperator'],
      expected: '0x005080F78567F8001115F1eee835DD0151BEA476',
    },
    {
      name: 'TestMBPOSTTEMPLATE',
      skip: false,
      only: false,
      debug: false,
      func: MBPOSTTEMPLATE,
      isTemplate: true,
      args: [2],
      expected: [['deployment', 'apiKey', 'address', 'contract', 'method', 'from', 'signer', 'input0', 'input1', 'txHash (output)']],
    },
    {
      name: 'TestMBQUERY',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['Faucet', 2],
      expected: [
        ['deposit', 'sender'],
        [1000000000000000000, '0x317570b8c43fecadb8ebaf765044ad9626f4848e'],
      ],
    },
    {
      name: 'TestMBTX',
      skip: false,
      only: false,
      debug: false,
      func: MBTX,
      args: ['0xfe9e4b800d14c36f2e8c26ab44ffcfcbf55ac71d6f0d5f2ac95b3d63c7f71569'],
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
          42,
          20000000000,
          22774,
          '0xe9f2e2b0105b683b436fd0d7a2895be25c310af7',
          // TODO: Fix tx value format issue in a spreadsheet
          // https://github.com/curvegrid/hackathon-sunset-supreme/issues/15
          formatDateTime('1E+18'),
          '0xd0e30db0',
          '0xf0742a46',
          '0xf7d63ad5985bfcc8f1764198a32d7e1800e852b2408068b0904187c3e3b3c4dc',
          '0x290fae6d05ef9007ce21f8144629edbd7ebf23a1205a3b4a74a3746c6737132c',
          '0xfe9e4b800d14c36f2e8c26ab44ffcfcbf55ac71d6f0d5f2ac95b3d63c7f71569',
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
