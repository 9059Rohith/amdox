# ADR-002: Keycloak for Enterprise SSO

**Status:** Accepted  
**Date:** 2026-05-08  
**Deciders:** Security & Engineering Team  
**Context:** Authentication & Authorization System Selection

## Context

The Amdox ERP Suite requires enterprise-grade authentication and authorization with support for:

- Multi-tenancy with tenant-specific configurations
- Single Sign-On (SSO) via OIDC and SAML 2.0
- Multi-Factor Authentication (MFA)
- Role-Based Access Control (RBAC)
- Social login providers (Google, Microsoft, LinkedIn)
- API protection with JWT tokens
- User federation with LDAP/Active Directory
- Compliance requirements (SOC 2, ISO 27001, GDPR)

We evaluated three main options:
1. **Keycloak** (Open Source Identity and Access Management)
2. **Auth0** (Commercial IDaaS Platform)
3. **Custom Implementation** (Build in-house)

## Decision

We will use **Keycloak 25** as our Identity and Access Management (IAM) solution.

## Rationale

### Why Keycloak?

#### 1. **Cost Efficiency**
- **Open Source**: No per-user licensing fees
- **Self-Hosted**: Control over infrastructure costs
- **Unlimited Scale**: No pricing tiers or user limits
- **ROI**: Estimated savings of $50k-100k/year vs Auth0 at scale (10k+ users)

#### 2. **Enterprise Features (Built-in)**
- ✅ OIDC, OAuth 2.0, SAML 2.0 support
- ✅ Multi-tenancy via realms
- ✅ MFA (TOTP, WebAuthn, SMS)
- ✅ Identity brokering (Google, GitHub, Azure AD, etc.)
- ✅ LDAP/Active Directory federation
- ✅ Fine-grained authorization (UMA 2.0)
- ✅ Admin UI and REST API
- ✅ Event logging and audit trails
- ✅ Custom authentication flows (SPI)

#### 3. **Flexibility & Control**
- **Customization**: Full access to source code for modifications
- **Data Sovereignty**: User data stays in our infrastructure
- **No Vendor Lock-in**: Standard protocols (OIDC, SAML)
- **Integration**: Seamless integration with existing systems

#### 4. **Compliance & Security**
- **Data Residency**: Deploy in any region (GDPR compliance)
- **Security Audits**: Regular security updates from Red Hat
- **Standards Compliance**: FIPS 140-2, Common Criteria
- **SOC 2 Ready**: Comprehensive audit logging

#### 5. **Performance & Scalability**
- **High Throughput**: >10k logins/sec with clustering
- **Horizontal Scaling**: Stateless architecture
- **Database Flexibility**: PostgreSQL, MySQL, Oracle support
- **Caching**: Infinispan for distributed caching

### Auth0 Comparison

| Feature | Keycloak | Auth0 | Winner |
|---------|----------|-------|--------|
| **Cost** | Free (OSS) | $0.023/user/month | ✅ Keycloak |
| **OIDC/SAML** | ✅ Built-in | ✅ Built-in | 🤝 Tie |
| **MFA** | ✅ Free | ✅ Extra cost | ✅ Keycloak |
| **User Federation** | ✅ LDAP/AD | ✅ LDAP/AD | 🤝 Tie |
| **Customization** | ✅ Full control | ⚠️ Limited | ✅ Keycloak |
| **Data Control** | ✅ Self-hosted | ❌ SaaS only | ✅ Keycloak |
| **Setup Complexity** | ⚠️ Higher | ✅ Lower | ✅ Auth0 |
| **Managed Service** | ❌ Self-manage | ✅ Fully managed | ✅ Auth0 |
| **Vendor Lock-in** | ✅ None | ⚠️ Proprietary | ✅ Keycloak |
| **Enterprise Support** | ✅ Red Hat SSO | ✅ Enterprise plan | 🤝 Tie |

### Cost Analysis (5-Year TCO)

**Keycloak:**
- Infrastructure: $12k/year (2 instances + DB)
- DevOps: $20k/year (maintenance)
- **Total**: $160k over 5 years

**Auth0:**
- 10k users @ $0.023/user/month = $2,760/month
- Additional MFA costs: $500/month
- **Total**: $195k over 5 years (+ increases with growth)

**Savings with Keycloak**: ~$35k over 5 years (21% less)

At 50k users, savings increase to **$700k+ over 5 years** (63% less).

## Implementation Plan

### Phase 1: Setup & Configuration (Week 1-2)
1. Deploy Keycloak 25 in Docker (development)
2. Configure PostgreSQL backend
3. Create master realm and tenant realms
4. Set up admin console and initial users

### Phase 2: Integration (Week 3-4)
1. Integrate with NestJS API via `passport-jwt`
2. Implement RBAC guards and decorators
3. Configure refresh token rotation
4. Set up Redis for token blacklisting

### Phase 3: Features (Week 5-6)
1. Configure MFA (TOTP + WebAuthn)
2. Set up social login providers
3. Implement custom themes (Amdox branding)
4. Configure session policies per tenant

### Phase 4: Production Readiness (Week 7-8)
1. High-availability setup (clustered)
2. Backup and disaster recovery
3. Monitoring and alerting
4. Security hardening and audit

## Consequences

### Positive

- ✅ **Cost Savings**: No per-user fees, predictable infrastructure costs
- ✅ **Full Control**: Complete data sovereignty and customization
- ✅ **Standards-Based**: OIDC/SAML ensure portability
- ✅ **Enterprise Features**: Built-in MFA, federation, audit logging
- ✅ **Scalability**: Proven at massive scale (Red Hat customers)
- ✅ **Compliance**: Easier to meet data residency requirements
- ✅ **No Vendor Lock-in**: Can migrate to any OIDC-compliant provider

### Negative

- ⚠️ **Operational Overhead**: Must manage infrastructure, upgrades, backups
- ⚠️ **Initial Setup**: Steeper learning curve than Auth0
- ⚠️ **Support**: Community support vs commercial SLA (mitigated by Red Hat SSO option)
- ⚠️ **Responsibility**: Security patches and updates are our responsibility

### Mitigations

1. **DevOps Automation**
   - Dockerized deployment with health checks
   - Automated backups to S3
   - Infrastructure as Code (Terraform)
   - Monitoring via Prometheus + Grafana

2. **High Availability**
   - Multi-AZ deployment
   - Database replication
   - Session clustering with Infinispan
   - Load balancing with sticky sessions

3. **Security Hardening**
   - Regular vulnerability scanning (Trivy, Snyk)
   - Automated security updates
   - Rate limiting and DDoS protection
   - Regular security audits

4. **Documentation & Training**
   - Internal runbooks for operations
   - Architecture documentation
   - Team training on Keycloak administration
   - Incident response procedures

## Alternatives Considered

### 1. Auth0 (Commercial IDaaS)

**Pros:**
- Managed service (no infrastructure overhead)
- Quick setup and integration
- Excellent documentation and support
- Regular feature updates

**Cons:**
- High cost at scale ($2,760/month for 10k users)
- Vendor lock-in (proprietary extensions)
- Limited customization
- Data stored in Auth0's infrastructure

**Verdict:** ❌ Rejected due to long-term cost and vendor lock-in concerns

### 2. AWS Cognito

**Pros:**
- Fully managed AWS service
- Integrated with AWS ecosystem
- Pay-as-you-go pricing

**Cons:**
- Limited SAML support
- Vendor lock-in to AWS
- Complex customization
- Higher costs than Keycloak ($0.0055/MAU + MFA costs)

**Verdict:** ❌ Rejected due to limited enterprise features and AWS lock-in

### 3. Custom Implementation

**Pros:**
- Complete control
- Tailored to exact requirements
- No licensing costs

**Cons:**
- Significant development effort (6+ months)
- Security risks (crypto, session management)
- Maintenance burden
- Lack of standard protocols

**Verdict:** ❌ Rejected due to security risks and time-to-market

### 4. Okta

**Pros:**
- Enterprise-grade features
- Excellent SAML/OIDC support
- Strong compliance certifications

**Cons:**
- Even more expensive than Auth0
- Vendor lock-in
- Complex pricing tiers

**Verdict:** ❌ Rejected due to cost

## Success Criteria

**Must Have (Go-Live):**
- ✅ OIDC login flow working end-to-end
- ✅ JWT token validation in API
- ✅ RBAC with 4 roles (SuperAdmin, TenantAdmin, Manager, Viewer)
- ✅ MFA enforcement per tenant
- ✅ High-availability deployment

**Nice to Have (Post-Launch):**
- 🔄 SAML 2.0 for enterprise SSO
- 🔄 LDAP/AD federation
- 🔄 Custom authentication flows
- 🔄 Passwordless authentication (WebAuthn)

## References

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Keycloak GitHub Repository](https://github.com/keycloak/keycloak)
- [Red Hat Single Sign-On (Commercial Support)](https://access.redhat.com/products/red-hat-single-sign-on)
- [OIDC Specification](https://openid.net/connect/)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)

## Review Schedule

- **Next Review:** 2026-11-08 (6 months)
- **Criteria for Change:**
  - Operational overhead becomes unmanageable
  - Critical security vulnerabilities
  - Enterprise customers require commercial SLA
  - Cost savings no longer justify operational complexity
