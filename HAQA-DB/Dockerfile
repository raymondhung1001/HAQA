FROM postgres:17.0-alpine3.20

# Install wget for downloading the extension
RUN apk add --no-cache wget

# Install pg_uuidv7 extension
RUN cd /tmp && \
    wget -q "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.7.0/pg_uuidv7.tar.gz" && \
    tar xf pg_uuidv7.tar.gz && \
    PG_MAJOR=$(pg_config --version | sed 's/^.* \([0-9]\{1,\}\).*$/\1/') && \
    cp "$PG_MAJOR/pg_uuidv7.so" "$(pg_config --pkglibdir)/" && \
    cp pg_uuidv7--1.7.sql "$(pg_config --sharedir)/extension/" && \
    cp pg_uuidv7.control "$(pg_config --sharedir)/extension/" && \
    rm -rf /tmp/pg_uuidv7* /tmp/SHA256SUMS

