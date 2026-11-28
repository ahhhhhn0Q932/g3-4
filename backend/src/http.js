function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function publicClass(row) {
  return row ? { id: Number(row.id), name: row.name, status: row.status } : null;
}

module.exports = { asyncHandler, publicClass };
