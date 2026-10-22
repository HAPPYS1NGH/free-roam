#!/bin/bash
# Creates a self-signed code signing certificate called "Static Development"
# in your login keychain, for scripts/bundle.sh to sign with.
#
# An ad-hoc signature changes with every build, and macOS drops Static's
# Screen Recording permission whenever it does. A certificate gives every
# build the same identity, so the permission sticks. Run it once per Mac.
set -euo pipefail

NAME="Static Development"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -p codesigning "$KEYCHAIN" | grep -q "\"$NAME\""; then
  echo "\"$NAME\" is already in your login keychain."
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cat > "$WORK/cert.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
EOF

# The system's LibreSSL writes a .p12 that `security import` can read;
# Homebrew's OpenSSL 3 defaults to a format it rejects.
/usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$WORK/cert.cnf" \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" 2>/dev/null

# The password only protects the .p12 on its way into the keychain.
export P12_PASSWORD="$(uuidgen)"
/usr/bin/openssl pkcs12 -export -name "$NAME" -inkey "$WORK/key.pem" -in "$WORK/cert.pem" \
  -out "$WORK/cert.p12" -passout env:P12_PASSWORD

security import "$WORK/cert.p12" -k "$KEYCHAIN" -P "$P12_PASSWORD" -T /usr/bin/codesign
echo "Added \"$NAME\" to your login keychain."
