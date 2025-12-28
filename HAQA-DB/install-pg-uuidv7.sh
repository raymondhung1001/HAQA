#!/bin/sh
set -e

echo "Installing pg_uuidv7 extension..."

# Install required tools (Alpine Linux)
if ! command -v wget >/dev/null 2>&1 && ! command -v curl >/dev/null 2>&1; then
    echo "Installing wget..."
    apk add --no-cache wget
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Download the extension (use wget if available, otherwise curl)
echo "Downloading pg_uuidv7 v1.7.0..."
if command -v wget >/dev/null 2>&1; then
    wget -q "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.7.0/pg_uuidv7.tar.gz"
    wget -q "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.7.0/SHA256SUMS"
else
    curl -L -o pg_uuidv7.tar.gz "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.7.0/pg_uuidv7.tar.gz"
    curl -L -o SHA256SUMS "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.7.0/SHA256SUMS"
fi

# Verify checksum (Alpine uses sha256sum from coreutils)
echo "Verifying checksum..."
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c SHA256SUMS || (echo "Checksum verification failed!" && exit 1)
elif command -v sha256 >/dev/null 2>&1; then
    # Alternative for some systems
    sha256 -c SHA256SUMS || (echo "Checksum verification failed!" && exit 1)
else
    echo "Warning: Could not verify checksum (sha256sum not found)"
fi

# Extract the archive
echo "Extracting archive..."
tar xf pg_uuidv7.tar.gz

# Get Postgres major version (17 in this case)
PG_MAJOR=$(pg_config --version | sed 's/^.* \([0-9]\{1,\}\).*$/\1/')
echo "PostgreSQL version: $PG_MAJOR"

# Copy the shared library
echo "Copying pg_uuidv7.so to $(pg_config --pkglibdir)..."
cp "$PG_MAJOR/pg_uuidv7.so" "$(pg_config --pkglibdir)/"

# Copy the SQL and control files
echo "Copying extension files to $(pg_config --sharedir)/extension..."
cp pg_uuidv7--1.7.sql "$(pg_config --sharedir)/extension/"
cp pg_uuidv7.control "$(pg_config --sharedir)/extension/"

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo "pg_uuidv7 extension files installed successfully!"

