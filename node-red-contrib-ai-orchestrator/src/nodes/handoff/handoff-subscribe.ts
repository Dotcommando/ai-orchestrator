import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

interface ISubscribeConfig {
  name?: string;
  topicMode: 'auto' | 'manual';
  topic?: string;
  match: 'exact' | 'prefix';
  passNonMatching?: boolean;
  intents: string;
  projectId?: string;
  teammate?: string;
}

function register(RED: IRED): void {
  function buildTopic(projectId: string, teammate: string, intent: string): string {
    const project = encodeURIComponent(projectId);
    const team = encodeURIComponent(teammate);

    return 'project/' + project + '/team/' + team + '/' + intent;
  }

  function matchesTopic(
    actualTopic: string,
    expectedTopic: string,
    mode: 'exact' | 'prefix',
  ): boolean {
    if (mode === 'prefix') return actualTopic.indexOf(expectedTopic) === 0;

    return actualTopic === expectedTopic;
  }

  function HandoffSubscribe(this: INode, config: ISubscribeConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const mode = config.topicMode ?? 'auto';
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const actualTopic = String((msg as { topic?: unknown }).topic ?? '');
      let isMatch = false;

      if (mode === 'manual') {
        const expectedTopic = String(config.topic ?? '');

        isMatch = expectedTopic ? matchesTopic(actualTopic, expectedTopic, config.match ?? 'exact') : false;
      } else {
        const projectId = config.projectId ?? msg.projectId ?? '';
        const teammate = config.teammate ?? msg.actor?.to ?? '';
        const intentList = (config.intents ?? 'first-pass')
          .split(',')
          .map((intentName) => intentName.trim())
          .filter((intentName) => intentName.length > 0);

        if (projectId && teammate && intentList.length > 0) {
          for (let i = 0; i < intentList.length; i++) {
            const expectedTopic = buildTopic(
              String(projectId),
              String(teammate),
              String(intentList[i]),
            );

            if (matchesTopic(actualTopic, expectedTopic, config.match ?? 'exact')) {
              isMatch = true;
              break;
            }
          }
        }
      }
      if (isMatch || (config.passNonMatching ?? false)) {
        send(msg);
      }

      return done();
    });
  }

  RED.nodes.registerType<ISubscribeConfig>('handoff-subscribe', HandoffSubscribe);
}

export = register;
