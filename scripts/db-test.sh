#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres database and runs the
# SQL assertions in supabase/tests/*.test.sql against it. Needs a local
# Postgres server and permission to run psql as the postgres OS user.
set -uo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-fam_test}
psql_pg() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 $*"; }

if command -v pg_lsclusters >/dev/null; then
  pg_lsclusters -h | awk '$4=="down"{print $1, $2}' | while read -r ver name; do pg_ctlcluster "$ver" "$name" start; done
fi

status=0
for t in supabase/tests/*.test.sql; do
  echo "drop database if exists $DB; create database $DB;" | psql_pg >/dev/null || exit 1
  out=$(cat supabase/tests/stub.sql supabase/migrations/*.sql "$t" | psql_pg "-d $DB" 2>&1)
  code=$?
  echo "$out" | grep -v -e 'wal_level' || true
  if [ $code -ne 0 ]; then echo "FAIL $t"; status=1; else echo "PASS $t"; fi
done
echo "drop database if exists $DB;" | psql_pg >/dev/null
exit $status
