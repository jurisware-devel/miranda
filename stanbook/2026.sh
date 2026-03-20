mvn -q -DskipTests compile dependency:build-classpath -Dmdep.outputFile=/tmp/stanbook.cp

CLASSPATH="target/classes:$(cat /tmp/stanbook.cp)"

find /Users/jonathan/Projects/miranda-opinions/coa/2026 -type f -name '*.htm' | while read -r f; do
  out="${f%.htm}.md"
  java -cp "$CLASSPATH" dev.stanbook.cli.StanbookCli "$f" > "$out"
done

