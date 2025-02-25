import { Injectable } from '@nestjs/common';
import { IEmailBlock, OrganizationRepository, OrganizationEntity } from '@novu/dal';
import { CompileTemplate } from '../compile-template/compile-template.usecase';
import { CompileTemplateCommand } from '../compile-template/compile-template.command';
import { PreviewEmailCommand } from './preview-email.command';

@Injectable()
export class PreviewEmail {
  constructor(private compileTemplate: CompileTemplate, private organizationRepository: OrganizationRepository) {}

  public async execute(command: PreviewEmailCommand) {
    const isEditorMode = command.contentType === 'editor';
    const [organization, content]: [OrganizationEntity, string | IEmailBlock[]] = await Promise.all([
      this.organizationRepository.findById(command.organizationId),
      this.getContent(isEditorMode, command.content),
    ]);

    const html = await this.compileTemplate.execute(
      CompileTemplateCommand.create({
        templateId: isEditorMode ? 'basic' : 'custom',
        customTemplate: !isEditorMode ? (content as string) : undefined,
        data: {
          blocks: isEditorMode ? content : [],
          branding: {
            logo: organization.branding?.logo,
            color: organization.branding?.color || '#f47373',
          },
        },
      })
    );

    return { html };
  }

  private async getContent(isEditorMode, content: string | IEmailBlock[]): Promise<string | IEmailBlock[]> {
    if (isEditorMode && Array.isArray(content)) {
      content = [...content] as IEmailBlock[];
      for (const block of content) {
        block.content = await this.renderContent(block.content);
        block.content = block.content.trim();
        block.url = await this.renderContent(block.url || '');
      }

      return content;
    }

    return content;
  }

  private async renderContent(content: string) {
    return await this.compileTemplate.execute(
      CompileTemplateCommand.create({
        templateId: 'custom',
        customTemplate: (content as string).replace(new RegExp('{{', 'g'), '\\{{'),
        data: {},
      })
    );
  }
}
