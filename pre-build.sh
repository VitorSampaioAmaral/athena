#!/bin/bash
pnpm install --force --no-frozen-lockfile
export NODE_OPTIONS=--openssl-legacy-provider
pnpm run build
