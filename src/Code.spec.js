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
    t.deepEqual(actualSheet, testCase.expected);

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
      skip: true,
      func: MBADDRESS,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBBLOCK',
      skip: true,
      func: MBBLOCK,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBCOMPOSE',
      skip: true,
      func: MBCOMPOSE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBCUSTOMQUERY',
      skip: true,
      func: MBCUSTOMQUERY,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBCUSTOMQUERYTEMPLATE',
      skip: true,
      func: MBCUSTOMQUERYTEMPLATE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBEVENTLIST',
      skip: true,
      func: MBEVENTLIST,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBEVENTS',
      skip: true,
      func: MBEVENTS,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBFUNCTIONLIST',
      skip: true,
      func: MBFUNCTIONLIST,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBGET',
      skip: true,
      func: MBGET,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBPOSTTEMPLATE',
      skip: true,
      func: MBPOSTTEMPLATE,
      args: [],
      expected: [],
    },
    {
      name: 'TestMBQUERY',
      skip: false,
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
      func: MBTX,
      args: [],
      expected: [],
    },
  ];

  // TODO: cover internal functions
  // https://github.com/curvegrid/hackathon-sunset-supreme/issues/5

  // eslint-disable-next-line no-restricted-syntax
  for (const testCase of testCases) {
    run(test, config, testCase);
  }

  test.finish();

  return { failures: test.totalFailed(), log: loggerAPI() };
}
