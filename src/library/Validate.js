// Copyright (c) 2020 Curvegrid Inc.

const VALID_AGGREGATORS = ['subtract', 'add', 'first', 'last', 'max', 'min', ''];
const VALID_BOOLEANS = ['and', 'or'];
const VALID_OPERATORS = ['equal', 'notequal', 'lessthan', 'greaterthan'];
const VALID_OPERANDS = ['input', 'contracts.label', 'contracts.contract_name', 'addresses.address', 'addresses.label'];

function validateOperator(operator) {
  operator = String(operator).toLowerCase();
  if (!VALID_OPERATORS.includes(operator)) {
    throw new Error(`'${operator}' is not a valid operator, must be one of ${VALID_OPERATORS.join(',')}`);
  }

  return operator;
}

function validateAggregator(aggregator) {
  aggregator = String(aggregator).toLowerCase();
  if (!VALID_AGGREGATORS.includes(aggregator)) {
    throw new Error(`'${aggregator}' is not a valid aggregator, must be one of ${VALID_AGGREGATORS.join(',')}`);
  }

  return aggregator;
}

function validateBlockNumOrHash(numOrHash) {
  if (numOrHash === undefined || numOrHash === '') {
    throw new Error('must provide a block number or hash');
  }

  // fast return if it's a valid positive integer
  if (isNaturalNumber(numOrHash)) {
    return;
  }

  validateBlockTxHash(numOrHash);
}

function validateBlockTxHash(hash) {
  hash = String(hash);

  if (hash === undefined || hash === '' || hash.length < 2) {
    throw new Error('must provide a hash');
  }

  if (hash.substring(0, 2).toLowerCase() !== '0x') {
    throw new Error("hash must start with '0x'");
  }

  if (hash.length !== 66) {
    throw new Error(`invalid hash length of ${hash.length}, should be 64 hex characters long excluding the '0x' prefix`);
  }

  if (!RegExp('^0[xX][A-Fa-f0-9]+$').test(hash)) {
    throw new Error('hash contains non-hexidecimal digits (outside of 0-9 and a-f)');
  }
}
