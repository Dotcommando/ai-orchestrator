import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

function register(RED: IRED): void {
  function StagePlanRunner(this: INode, config: unknown): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      send(msg);

      return done();
    });
  }

  RED.nodes.registerType('stage-plan-runner', StagePlanRunner);
}

export = register;
