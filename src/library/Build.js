// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars, no-undef */

function buildSelects(items, start, numItems) {
  const triplets = [];
  for (let i = start; i < numItems * 3; i += 3) {
    // not all rows will have the same number of triplets
    if (items[i] === '') {
      break;
    }

    const triplet = {
      alias: items[i],
      inputIndex: parseInt(items[i + 1], 10),
      type: 'input',
    };
    const aggregator = validateAggregator(items[i + 2]);
    if (aggregator !== '') {
      triplet.aggregator = aggregator;
    }
    triplets.push(triplet);
  }

  return triplets;
}

function buildFilters(items, start, numItems) {
  const filter = {};
  for (let i = start; i < start + numItems * 3; i += 3) {
    const rules = items[i];
    const operator = items[i + 1];
    const value = items[i + 2];

    // not all rows will have the same number of filters
    if (rules === '') {
      break;
    }

    if (value === '') {
      throw new Error(`Value is empty for rule '${rules}'`);
    }

    // split by colons
    const rulePath = rules.split(':');
    if (rulePath.length === 1) {
      // special case for a single rule
      rulePath.unshift('And');
    }

    // loop through 'and' and 'or', creating children if they don't exist
    let node = filter;
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const j in rulePath) {
      // parse out rule and optional numeric portions (e.g., input0)
      const ruleParts = RegExp('^([A-Za-z.]+)([0-9]*)$').exec(rulePath[j]);
      if (ruleParts === null || ruleParts.length < 2) {
        throw new Error(`Invalid rule '${rulePath[j]}' in '${rules}'`);
      }
      const rule = ruleParts[1].toLowerCase();
      if (rule === '') {
        throw new Error(`Sub-rule is empty in '${rules}'`);
      }

      // if we're on a children array, search for a child matching this rule
      if (Array.isArray(node)) {
        // find the one that matches this rule
        let matchedChild = false;
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const k in node) {
          if (node[k].rule === rule) {
            // node 'array' becomes an 'object' again
            node = node[k];
            matchedChild = true;
            break;
          }
        }

        // no match for this rule so add a new child
        if (!matchedChild) {
          node.push({});
          // node 'array' becomes an 'object' again
          node = node[node.length - 1];
        } else {
          // otherwise, we matched, so next rule
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      // add a rule or descend to the next level down as appropriate
      if (VALID_BOOLEANS.includes(rule)) {
        if (Object.keys(node).length === 0) {
          // new child node
          node.rule = rule;
          node.children = [{}];
          [node] = node.children;
        } else {
          // existing child node

          // node 'object' becomes a 'array'
          node = node.children;
        }
      } else if (VALID_OPERANDS.includes(rule)) {
        // at the last level, add the rule

        // first, ensure we're actually at a leaf node
        // if not, add us to the children array
        if (Object.keys(node).length > 0) {
          node.children.push({});
          node = node.children[node.children.length - 1];
        }

        node.rule = rule;
        node.operator = validateOperator(operator);
        node.value = String(value);

        // special case for an input
        if (rule === 'input') {
          if (ruleParts.length !== 3) {
            throw new Error("No input index provided, just 'input'");
          }
          const inputIndex = ruleParts[2];
          if (!isNaturalNumber(inputIndex)) {
            throw new Error(`Invalid input index '${inputIndex}', must be a positive number`);
          }
          node.inputIndex = parseInt(inputIndex, 10);
        }
      }
    }
  }

  return filter;
}

function buildCustomQuery(events, groupBy, orderBy, limit, offset) {
  const query = {
    events: [],
  };

  if (groupBy && groupBy !== '') {
    query.groupBy = groupBy;
  }
  if (orderBy && orderBy !== '') {
    query.orderBy = orderBy;
  }

  // parse and validate header row
  if (events.length < 1) {
    throw new Error(`Expecting a header row followed by one or more data rows, found ${events.length} rows total`);
  }
  const header = events[0];
  if (header.length < 4) {
    throw new Error(`Expecting to have at least four columns, found ${header.length} columns total`);
  }
  if ((header.length - 1) % 3 !== 0) {
    throw new Error(`Expecting number of columns to be divisible by 3 plus 1, found ${header.length} columns total`);
  }
  if (header[0].toLowerCase() !== 'eventname') {
    throw new Error(`Expecting first column in header row to be 'eventName', found '${header[0]}'`);
  }

  // extract the number of select and filter triplets
  const [numSelect, numFilter] = extractSelectFilterCounts(header);

  // build the event query
  for (let i = 1; i < events.length; i++) {
    const event = events[i];

    // build selects and filters
    const selects = buildSelects(event, 1, numSelect);
    const filters = buildFilters(event, 1 + numSelect * 3, numFilter);
    const newQuery = {
      eventName: event[0],
      select: selects,
    };

    // Add filter only if filter exists
    // If empty filter is added then API will return 502
    if (Object.keys(filters).length > 0) {
      newQuery.filter = filters;
    }

    query.events.push(newQuery);
  }

  return query;
}

function buildMethodArgs(args, from, signer, signAndSubmit, value) {
  const payload = {
    args,
    contractOverride: true,
  };

  // optional from and signer for "write" transactions
  if (from) {
    payload.from = from;
    payload.signer = signer;

    if (!signer) {
      payload.signer = from;
    }

    if (value) {
      payload.value = value;
    }

    // optional "sign and submit" for HSM addresses
    if (signAndSubmit) {
      payload.signAndSubmit = signAndSubmit;
    }
  }

  return payload;
}

function buildQueryOptions(limit, offset, address) {
  // validate limit
  if (limit && !isNaturalNumber(limit)) {
    throw new Error('Invalid limit, must be a positive integer');
  }

  // validate offset
  if (offset && !isNaturalNumber(offset)) {
    throw new Error('Invalid offset, must be a positive integer');
  }

  // validate address
  if (address && address.length < 1) {
    throw new Error('Invalid address, must be a string');
  }

  // generate a clean URL query param
  let queryOptions = '';
  if (limit) {
    queryOptions += `?limit=${limit}`;
  }
  if (offset) {
    if (queryOptions === '') {
      queryOptions += '?';
    } else {
      queryOptions += '&';
    }
    queryOptions += `offset=${offset}`;
  }
  if (address) {
    if (queryOptions === '') {
      queryOptions += '?';
    } else {
      queryOptions += '&';
    }
    queryOptions += `contract_address=${address}`;
  }

  return queryOptions;
}

function buildTxHashes(txs) {
  const hashes = txs.map((tx) => tx.hash);

  return hashes.join(',');
}

function buildAssociations(associations) {
  const summary = associations.map((association) => {
    let text = association.label;
    if (association.name && association.name !== '') {
      text += ` (${association.version})`;
    }
    if (association.version && association.version !== '') {
      text += ` ${association.version}`;
    }
    return text;
  });

  return summary.join(',');
}

function buildInputs(inputs, maxInputs) {
  // can't use inputs.map() here because we want to pad the array with empty entries
  // up to maxInputs length
  const values = [];
  for (let i = 0; i < maxInputs; i++) {
    let input;
    if (inputs && i < inputs.length) {
      input = inputs[i].value;
    }
    values.push(input);
  }

  return values;
}

function buildSigDef(event) {
  // insert name (if any) after each type in the event signature
  const parts = String(event.signature).split(',');
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in event.inputs) {
    const input = event.inputs[i];
    if (input.name !== '') {
      if (i === event.inputs.length - 1) {
        // special case for the last input
        parts[i] = `${parts[i].substring(0, parts[i].length - 1)} ${input.name})`;
      } else {
        parts[i] += ` ${input.name}`;
      }
    }
  }

  return parts.join(',');
}

function buildSeqHeader(prefix, numHeaders) {
  const headers = [];
  for (let i = 0; i < numHeaders; i++) {
    headers.push(prefix + String(i));
  }
  return headers;
}

function buildNumInputsOrOutputs(label, length) {
  if (length === 0) {
    return `no ${label}s`;
  } if (length === 1) {
    return `1 ${label}:\n`;
  }
  return `${length} ${label}s:\n`;
}

function buildType(paramType) {
  let builtType = paramType.type;
  if (paramType.type !== 'address' && paramType.type !== 'string' && paramType.size && paramType.size > 0) {
    builtType += paramType.size;
  }

  return builtType;
}

function buildFunctionInputsOrOutputs(entries) {
  const params = [];

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in entries) {
    const entry = entries[i];
    let param = entry.name;
    if (param !== '') {
      param += ' ';
    }
    param += buildType(entry.type);
    if (entry.notes && entry.notes !== '') {
      param += ` (${entry.notes})`;
    }
    params.push(param);
  }

  return params;
}
