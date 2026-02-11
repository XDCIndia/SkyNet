# Build XDC from source
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    g++ \
    linux-headers \
    git \
    make \
    cmake

# Set working directory
WORKDIR /build

# Clone XDPoSChain repository
ARG XDC_VERSION=v2.6.0
RUN git clone --depth 1 --branch ${XDC_VERSION} https://github.com/XinFinOrg/XDPoSChain.git .

# Build XDC
RUN make all

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    jq \
    wget

# Create xdc user
RUN addgroup -g 1000 xdc && \
    adduser -u 1000 -G xdc -s /bin/sh -D xdc

# Copy binaries from builder
COPY --from=builder /build/build/bin/XDC /usr/local/bin/
COPY --from=builder /build/build/bin/bootnode /usr/local/bin/
COPY --from=builder /build/build/bin/puppeth /usr/local/bin/

# Create data directory
RUN mkdir -p /xdcchain/XDC && \
    chown -R xdc:xdc /xdcchain

# Switch to xdc user
USER xdc

# Set working directory
WORKDIR /xdcchain

# Expose ports
EXPOSE 8545 8546 30303 30303/udp 6060

# Entry point
ENTRYPOINT ["XDC"]

# Default command
CMD ["--help"]
