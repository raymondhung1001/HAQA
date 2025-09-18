#!/bin/sh
# This script generates the Redis ACL file with credentials from environment variables

cat > /etc/redis/users.acl << EOF
# Admin user with full privileges
user admin on >${REDIS_ADMIN_PASSWORD} ~* &* +@all

# Application user with limited privileges
user app on >${REDIS_APP_PASSWORD} ~auth:* ~ratelimit:* +@read +@write -@admin -@dangerous
EOF

chmod 600 /etc/redis/users.acl
echo "Generated Redis ACL file with environment variables"