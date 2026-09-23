import hudson.plugins.git.BranchSpec
import hudson.plugins.git.GitSCM
import hudson.plugins.git.UserRemoteConfig
import jenkins.model.Jenkins
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition
import org.jenkinsci.plugins.workflow.job.WorkflowJob

def instance = Jenkins.get()
def jobName = 'self-hd-pipeline'

if (instance.getItem(jobName) == null) {
  def remote = new UserRemoteConfig('https://github.com/cpj-cpj/self-hd.git', null, null, null)
  def branch = new BranchSpec('*/main')
  def scm = new GitSCM([remote], [branch], false, [], null, null, [])
  def definition = new CpsScmFlowDefinition(scm, 'Jenkinsfile')
  definition.setLightweight(true)

  def job = instance.createProject(WorkflowJob, jobName)
  job.setDescription('SIT223 7.3HD pipeline seeded from the self-hd GitHub repository.')
  job.setDefinition(definition)
  job.save()
}
