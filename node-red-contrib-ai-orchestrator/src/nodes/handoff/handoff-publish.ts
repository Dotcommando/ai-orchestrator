import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

interface IPublishConfig {
  name?: string;
  topicMode: 'auto' | 'manual';
  topic?: string;
  intent: 'first-pass' | 'rework' | 'wrapup' | 'human-override' | 'escalation';
  projectId?: string;
  teammate?: string;
}

function register(RED: IRED): void {
  function buildTopic(projectId: string, teammate: string, intent: string): string {
    const project = encodeURIComponent(projectId);
    const team = encodeURIComponent(teammate);

    return 'project/' + project + '/team/' + team + '/' + intent;
  }

  function HandoffPublish(this: INode, config: IPublishConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const mode = config.topicMode ?? 'auto';
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const previousTopic = (msg as { topic?: unknown }).topic;
      let topic = '';

      if (mode === 'manual') {
        topic = config.topic ?? '';
      } else {
        const projectId = config.projectId ?? msg.projectId ?? '';
        const teammate = config.teammate ?? msg.actor?.to ?? '';
        const intent = config.intent ?? 'first-pass';

        topic = projectId && teammate ? buildTopic(String(projectId), String(teammate), String(intent)) : '';
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (msg as { _prevTopic?: unknown })._prevTopic = previousTopic;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (msg as { topic?: string }).topic = topic;

      send(msg);

      return done();
    });
  }

  RED.nodes.registerType<IPublishConfig>('handoff-publish', HandoffPublish);
}

export = register;
