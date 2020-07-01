// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars, no-use-before-define */

const VALID_AGGREGATORS = ['subtract', 'add', 'first', 'last', 'max', 'min', ''];
const VALID_BOOLEANS = ['and', 'or'];
const VALID_OPERATORS = ['equal', 'notequal', 'lessthan', 'greaterthan'];
const VALID_OPERANDS = ['input', 'contracts.label', 'contracts.contract_name', 'addresses.address', 'addresses.label'];

function validateOperator(operator) {
  const operatorString = String(operator).toLowerCase();
  if (!VALID_OPERATORS.includes(operator)) {
    showAlert(`'${operatorString}' is not a valid operator, must be one of ${VALID_OPERATORS.join(',')}`);
    return undefined;
  }

  return operatorString;
}

function validateAggregator(aggregator) {
  const aggregatorString = String(aggregator).toLowerCase();
  if (!VALID_AGGREGATORS.includes(aggregatorString)) {
    showAlert(`'${aggregatorString}' is not a valid aggregator, must be one of ${VALID_AGGREGATORS.join(',')}`);
    return undefined;
  }

  return aggregatorString;
}

function validateBlockNumOrHash(numOrHash) {
  if (numOrHash === undefined || numOrHash === '') {
    showAlert('must provide a block number or hash');
    return;
  }

  // fast return if it's a valid positive integer
  if (isNaturalNumber(numOrHash)) {
    return;
  }

  validateBlockTxHash(numOrHash);
}

function validateBlockTxHash(hash) {
  const hashString = String(hash);

  if (hashString === undefined || hashString === '' || hashString.length < 2) {
    showAlert('must provide a hash');
    return;
  }

  if (hashString.substring(0, 2).toLowerCase() !== '0x') {
    showAlert("hash must start with '0x'");
    return;
  }

  if (hashString.length !== 66) {
    showAlert(`invalid hash length of ${hashString.length}, should be 64 hex characters long excluding the '0x' prefix`);
    return;
  }

  if (!RegExp('^0[xX][A-Fa-f0-9]+$').test(hashString)) {
    showAlert('hash contains non-hexidecimal digits (outside of 0-9 and a-f)');
  }
}
