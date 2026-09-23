import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import jenkins.model.Jenkins

def instance = Jenkins.get()
def username = System.getenv('JENKINS_ADMIN_ID') ?: 'admin'
def password = System.getenv('JENKINS_ADMIN_PASSWORD') ?: 'admin123'

def realm = new HudsonPrivateSecurityRealm(false)
if (realm.getUser(username) == null) {
  realm.createAccount(username, password)
}
instance.setSecurityRealm(realm)

def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)

instance.save()

